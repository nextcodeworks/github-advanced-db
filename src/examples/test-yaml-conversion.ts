import dotenv from 'dotenv';
dotenv.config();

import { GitHubDB } from '..';

async function testYAMLConversion() {
  console.log('🚀 Starting YAML Conversion Tests...\n');

  try {
    // Initialize the database
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

    // Test data
    const testUsers = [
      {
        id: 'user_001',
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
        age: 28
      },
      {
        id: 'user_002',
        name: 'Bob',
        email: 'bob@example.com',
        password: 'password456',
        age: 32
      },
      {
        id: 'user_003',
        name: 'Charlie',
        email: 'charlie@example.com',
        password: 'young123',
        age: 25
      }
    ];

    // Clean up any existing test files
    const testFiles = [
      'tests/test_users.json',
      'tests/test_users.jsonl',
      'tests/test_users.csv',
      'tests/test_users_from_json.yaml',
      'tests/test_users_from_jsonl.yaml',
      'tests/test_users_from_csv.yaml'
    ];

    for (const file of testFiles) {
      try {
        await db['api'].deleteFile(file, `Clean up test file: ${file}`);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }

    // Create test directory if it doesn't exist
    try {
      await db.createCollection('tests', { format: 'json' });
    } catch (error) {
      // Directory might already exist
    }

    // Test 1: Convert JSON to YAML
    console.log('🔄 TEST 1: Converting JSON to YAML...');
    
    // Create a JSON file
    await db.set('tests/test_users.json', testUsers[0]);
    
    // Convert to YAML
    await db.transfer(
      'tests/test_users.json',
      'tests/test_users_from_json.yaml',
      () => true,
      {
        conversion: {
          sourceFormat: 'json',
          targetFormat: 'yaml',
          indent: 2,
          timestampField: 'exported_at'
        }
      }
    );
    
    // Read and verify
    console.log('✅ JSON to YAML conversion successful');
    console.log('📄 YAML content from JSON:');
    const jsonYamlFile = await db['api'].getFile('tests/test_users_from_json.yaml');
    if (jsonYamlFile) {
      console.log(jsonYamlFile.content);
      // Parse the YAML content directly
      const yaml = require('yaml');
      const parsedYaml = yaml.parse(jsonYamlFile.content);
      console.log('📄 Parsed YAML from JSON:', parsedYaml);
    }

    // Test 2: Convert JSONL to YAML
    console.log('\n🔄 TEST 2: Converting JSONL to YAML...');
    
    // Create a JSONL file using transfer from a temporary JSON file
    await db.set('tests/temp_users.json', testUsers);
    await db.transfer(
      'tests/temp_users.json',
      'tests/test_users.jsonl',
      () => true,
      {
        conversion: {
          sourceFormat: 'json',
          targetFormat: 'jsonl'
        }
      }
    );
    await db['api'].deleteFile('tests/temp_users.json', 'Clean up temporary file');
    
    // Convert to YAML
    await db.transfer(
      'tests/test_users.jsonl',
      'tests/test_users_from_jsonl.yaml',
      () => true,
      {
        conversion: {
          sourceFormat: 'jsonl',
          targetFormat: 'yaml',
          indent: 2,
          timestampField: 'exported_at'
        }
      }
    );
    
    // Read and verify
    console.log('✅ JSONL to YAML conversion successful');
    console.log('📄 YAML content from JSONL:');
    const jsonlYamlFile = await db['api'].getFile('tests/test_users_from_jsonl.yaml');
    if (jsonlYamlFile) {
      console.log(jsonlYamlFile.content);
      // Parse the YAML content directly
      const yaml = require('yaml');
      const parsedYaml = yaml.parseAllDocuments(jsonlYamlFile.content).map((doc: any) => doc.toJSON());
      console.log('📄 Parsed YAML from JSONL:', parsedYaml);
    }

    // Test 3: Convert CSV to YAML
    console.log('\n🔄 TEST 3: Converting CSV to YAML...');
    
    // Create a CSV file
    await db.transfer(
      'tests/test_users.jsonl',
      'tests/test_users.csv',
      () => true,
      {
        conversion: {
          sourceFormat: 'jsonl',
          targetFormat: 'csv'
        }
      }
    );
    
    // Convert to YAML
    await db.transfer(
      'tests/test_users.csv',
      'tests/test_users_from_csv.yaml',
      () => true,
      {
        conversion: {
          sourceFormat: 'csv',
          targetFormat: 'yaml',
          indent: 2,
          timestampField: 'exported_at'
        }
      }
    );
    
    // Read and verify
    console.log('✅ CSV to YAML conversion successful');
    console.log('📄 YAML content from CSV:');
    const csvYamlFile = await db['api'].getFile('tests/test_users_from_csv.yaml');
    if (csvYamlFile) {
      console.log(csvYamlFile.content);
      // Parse the YAML content directly
      const yaml = require('yaml');
      const parsedYaml = yaml.parseAllDocuments(csvYamlFile.content).map((doc: any) => doc.toJSON());
      console.log('📄 Parsed YAML from CSV:', parsedYaml);
    }

    console.log('\n✅ All YAML conversion tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the tests
testYAMLConversion();
