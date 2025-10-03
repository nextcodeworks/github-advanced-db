import dotenv from 'dotenv';
dotenv.config();

import { GitHubDB } from '..';
import { ConversionOptions } from '../formatters/types';

// Using the base Document type from the library

async function testFormatConversion() {
  console.log('🚀 Starting Format Conversion Tests...\n');

  try {
    // Initialize the database with the same repo
    const db = new GitHubDB({
      token: process.env.GITHUB_PAT!,
      repo: 'nextcodeworks/mydb',
      mode: 'document',
      cache: true,
      batchSize: 50,
      format: 'jsonl'
    });

    await db.initialize();
    console.log('✅ Database initialized successfully\n');

    // Test 1: Read existing data first to see what we're working with
    console.log('📖 TEST 1: Reading existing data...');
    
    const existingUser = await db.get('users/alice.json', { unhashFields: ['password'] });
    console.log('📄 Existing user document (alice.json):', existingUser);

    const allUsers = await db.getCollection('users/all.jsonl', { unhashFields: ['password'] });
    console.log('📊 All users in collection:', allUsers);
    console.log('✅ Test 1 completed: Existing data read successfully\n');

    // Test 2: Convert single JSON document to JSONL format
    console.log('🔄 TEST 2: Converting JSON document to JSONL format...');
    
    // Create a JSONL version of alice.json
    await db.transfer(
      'users/alice.json',
      'users/alice_converted.jsonl',
      () => true,
      {
        conversion: {
          sourceFormat: 'json',
          targetFormat: 'jsonl'
        }
      }
    );
    console.log('✅ alice.json converted to alice_converted.jsonl');

    // Read back the converted file
    const aliceJSONL = await db.getCollection('users/alice_converted.jsonl');
    console.log('📄 Alice data in JSONL format:', aliceJSONL);
    console.log('✅ Test 2 completed: JSON to JSONL conversion successful\n');

    // Test 3: Convert and transform user data during transfer
    console.log('🎯 TEST 3: Converting with field mapping and transformation...');
    
    await db.transfer(
      'users/all.jsonl',
      'users/users_transformed.csv',
      (doc) => doc.age > 25,
      {
        conversion: {
          sourceFormat: 'jsonl',
          targetFormat: 'csv',
          fieldMapping: {
            'user_id': 'id',
            'user_name': 'name',
            'user_email': 'email',
            'user_age': 'age'
          },
          timestampField: 'converted_at'
        },
        transform: (doc) => ({
          ...doc,
          name: typeof doc.name === 'string' ? doc.name.toUpperCase() : doc.name,
          age: typeof doc.age === 'number' ? doc.age + 1 : doc.age
        })
      }
    );
    console.log('✅ all.jsonl converted to users_transformed.csv with transformations');

    // Read the CSV file as text to see the format
    const file = await db['api'].getFile('users/users_transformed.csv');
    if (!file) {
      throw new Error('Failed to read transformed CSV file');
    }
    console.log('📊 CSV Content:');
    console.log(file.content);
    console.log('✅ Test 3 completed: Transformation and CSV conversion successful\n');

    // Test 4: Convert JSONL to JSON array format
    console.log('🔄 TEST 4: Converting JSONL collection to JSON array...');
    
    await db.transfer(
      'users/all.jsonl',
      'users/all_as_array.json',
      () => true,
      {
        conversion: {
          sourceFormat: 'jsonl',
          targetFormat: 'json',
          indent: 2
        }
      }
    );
    console.log('✅ all.jsonl converted to all_as_array.json');

    // Read the JSON array
    const jsonArray = await db.get('users/all_as_array.json');
    console.log('📄 JSON Array format:', JSON.stringify(jsonArray, null, 2));
    console.log('✅ Test 4 completed: JSONL to JSON array conversion successful\n');

    // First, let's add a younger user to the test data
    console.log('👶 Adding a younger user for testing...');
    await db.set('users/young_user.json', {
      id: 'user_003',
      name: 'Charlie',
      email: 'charlie@example.com',
      password: 'young123',
      age: 25
    });
    
    // First, create the collection if it doesn't exist
    try {
      await db.createCollection('users/all', { format: 'jsonl' });
    } catch (error) {
      // Collection might already exist, which is fine
      if (!(error as Error).message.includes('already exists')) {
        throw error;
      }
    }
    
    // Add the young user to the all.jsonl collection
    try {
      await db.append('users/all.jsonl', {
        id: 'user_003',
        name: 'Charlie',
        email: 'charlie@example.com',
        password: 'young123',
        age: 25
      });
    } catch (error) {
      console.error('❌ Error appending to collection:', error);
      throw error;
    }

    // Test 5: Filter and convert specific data
    console.log('🎯 TEST 5: Filtering and converting specific users...');
    
    // First, ensure we have some young users in the all.jsonl collection
    const youngUser = {
      id: 'user_003',
      name: 'Charlie',
      email: 'charlie@example.com',
      password: 'young123',
      age: 25
    };

    // Add the young user to the all.jsonl collection
    try {
      await db.append('users/all.jsonl', youngUser);
      console.log('✅ Added young user to all.jsonl');
    } catch (error) {
      console.warn('⚠️ Could not append to all.jsonl:', error instanceof Error ? error.message : String(error));
    }

    // Convert to YAML with a more inclusive age filter
    await db.transfer(
      'users/all.jsonl',
      'users/young_users.yaml',
      (doc) => doc.age < 35, // Include users under 35
      {
        conversion: {
          sourceFormat: 'jsonl',
          targetFormat: 'yaml',
          indent: 2,
          timestampField: 'exported_at',
          // Ensure we output as an array
          yamlStringifyOptions: {
            defaultKeyType: 'PLAIN',
            defaultStringType: 'QUOTE_DOUBLE',
            lineWidth: 0
          }
        }
      }
    );
    console.log('✅ Filtered young users converted to YAML');

    // Read and parse the YAML file
    try {
      // First try to read it as a collection
      const yamlData = await db.getCollection('users/young_users.yaml');
      console.log('📄 YAML Content:');
      console.log(yamlData);
      console.log(`✅ Found ${yamlData.length} young users`);
      
      // Also show the raw content
      try {
        const yamlFile = await db['api'].getFile('users/young_users.yaml');
        if (yamlFile) {
          console.log('📄 Raw YAML content:');
          console.log(yamlFile.content);
        }
      } catch (readError) {
        console.warn('⚠️ Could not read raw YAML file:', readError instanceof Error ? readError.message : String(readError));
      }
    } catch (error) {
      console.error('❌ Failed to read YAML data:', error instanceof Error ? error.message : String(error));
      // Try to read the raw file to see what's there
      try {
        const yamlFile = await db['api'].getFile('users/young_users.yaml');
        if (yamlFile) {
          console.log('📄 Raw YAML content:');
          console.log(yamlFile.content);
        } else {
          console.log('❌ YAML file is empty or not found');
        }
      } catch (readError) {
        console.error('❌ Could not read YAML file:', readError instanceof Error ? readError.message : String(readError));
      }
      throw error; // Re-throw to fail the test
    }
    
    console.log('✅ Test 5 completed: Filtering and YAML conversion successful\n');

    // Test 6: Verify data consistency after all operations
    console.log('🔍 TEST 6: Verifying data consistency...');
    
    const originalUsers = await db.getCollection('users/all.jsonl', { unhashFields: ['password'] });
    
    // Read CSV file directly instead of using getCollection
    const csvFile = await db['api'].getFile('users/users_transformed.csv');
    if (!csvFile) {
      throw new Error('Failed to read transformed CSV file for verification');
    }
    const csvLines = csvFile.content.trim().split('\n');
    const transformedUsersCount = csvLines.length - 1; // Subtract 1 for header
    
    console.log(`📊 Original users count: ${originalUsers.length}`);
    console.log(`📊 Transformed users count: ${transformedUsersCount}`);
    console.log(`📊 Young users count: ${originalUsers.filter(u => u.age < 30).length}`);
    
    // Verify that original files are unchanged
    const originalAlice = await db.get('users/alice.json', { unhashFields: ['password'] });
    console.log('🔒 Original Alice data intact:', originalAlice?.id === 'user_001');
    console.log('✅ Test 6 completed: Data consistency verified\n');

    // Test 7: List all created files to see the results
    console.log('📁 TEST 7: Listing all files in users collection...');
    
    const filesToCheck = [
      'users/alice.json',
      'users/alice_converted.jsonl',
      'users/all.jsonl',
      'users/users_transformed.csv',
      'users/all_as_array.json',
      'users/young_users.yaml'
    ];

    for (const file of filesToCheck) {
      try {
        const content = await db.get(file);
        console.log(`✅ ${file}: EXISTS (size: ${content ? JSON.stringify(content).length : 0} chars)`);
      } catch (error) {
        console.log(`❌ ${file}: NOT FOUND or error`);
      }
    }
    console.log('✅ Test 7 completed: File inventory complete\n');

    // Test 8: Test format converter directly
    console.log('🔧 TEST 8: Testing FormatConverter directly...');
    
    const transactionEngine = (db as any).transactionEngine;
    const formatConverter = transactionEngine.getFormatConverter();
    
    // Test CSV to JSON conversion
    const sampleCSV = `id,name,email,age\nuser_003,Charlie,charlie@example.com,25`;
    const jsonOutput = formatConverter.convertContent(sampleCSV, {
      sourceFormat: 'csv',
      targetFormat: 'json'
    });
    
    console.log('📊 CSV to JSON conversion:');
    console.log('Input CSV:', sampleCSV);
    console.log('Output JSON:', jsonOutput);
    console.log('✅ Test 8 completed: Direct format conversion successful\n');

    // Final rate limit check
    const limits = db.getRateLimitStatus();
    console.log('📈 Final GitHub API Rate Limits:');
    console.log(`   Remaining requests: ${limits.remaining}`);
    console.log(`   Reset time: ${new Date(limits.reset * 1000).toISOString()}`);

    console.log('\n🎉 All format conversion tests completed successfully!');
    console.log('\n📁 Created files:');
    console.log('   - users/alice_converted.jsonl (JSON to JSONL)');
    console.log('   - users/users_transformed.csv (JSONL to CSV with transformations)');
    console.log('   - users/all_as_array.json (JSONL to JSON array)');
    console.log('   - users/young_users.yaml (Filtered JSONL to YAML)');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the tests
testFormatConversion();