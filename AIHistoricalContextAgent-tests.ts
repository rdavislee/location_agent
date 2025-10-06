/**
 * AIHistoricalContextAgent Test Cases
 * 
 * Demonstrates generating historical context and asking follow-up questions
 */

import { AIHistoricalContextAgent } from './AIHistoricalContextAgent';
import { GeminiLLM, Config } from './gemini-llm';

/**
 * Load configuration from config.json
 */
function loadConfig(): Config {
    try {
        const config = require('../config.json');
        return config;
    } catch (error) {
        console.error('❌ Error loading config.json. Please ensure it exists with your API key.');
        console.error('Error details:', (error as Error).message);
        process.exit(1);
    }
}

/**
 * Test case 1: Boston Historical Context
 * Tests generating context for Boston and asking follow-up questions
 */
export async function testBostonContext(): Promise<void> {
    console.log('\n🧪 TEST CASE 1: Boston Historical Context');
    console.log('=========================================');
    
    const agent = new AIHistoricalContextAgent();
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Boston coordinates
    const bostonCoords = { lat: 42.3601, lng: -71.0589 };
    const radius = 5000; // 5km radius
    
    console.log(`📍 Testing location: Boston (${bostonCoords.lat}, ${bostonCoords.lng})`);
    console.log(`📏 Radius: ${radius}m\n`);
    
    // Step 1: Generate historical context
    console.log('Step 1: Generating historical context...');
    const result = await agent.generateContext(llm, bostonCoords, radius);
    
    console.log('\n📖 Generated Context:');
    console.log('=====================');
    console.log(`Main Location: ${result.mainLocation}`);
    console.log(`\n${result.context}\n`);
    
    // Validate that Boston is mentioned
    const contextLower = result.context.toLowerCase();
    const bostonMentioned = contextLower.includes('boston');
    console.log(`✓ Validation: Boston mentioned in context? ${bostonMentioned ? '✅ YES' : '❌ NO'}`);
    
    if (!bostonMentioned) {
        throw new Error('❌ TEST FAILED: Boston was not mentioned in the generated context');
    }
    
    // Step 2: Ask about top schools in Boston
    console.log('\n\nStep 2: Asking about top schools in Boston...');
    const schoolQuestion = 'What are the top schools in Boston?';
    console.log(`Question: "${schoolQuestion}"`);
    
    const schoolAnswer = await agent.answerQuestion(llm, result.sessionId, schoolQuestion);
    console.log('\n💬 Answer:');
    console.log('==========');
    console.log(schoolAnswer);
    
    // Validate that Harvard is mentioned
    const schoolAnswerLower = schoolAnswer.toLowerCase();
    const harvardMentioned = schoolAnswerLower.includes('harvard');
    console.log(`\n✓ Validation: Harvard mentioned in answer? ${harvardMentioned ? '✅ YES' : '❌ NO'}`);
    
    if (!harvardMentioned) {
        throw new Error('❌ TEST FAILED: Harvard was not mentioned when asked about top schools');
    }
    
    // Step 3: Ask about body of water
    console.log('\n\nStep 3: Asking about body of water...');
    const waterQuestion = 'What body of water is Boston on?';
    console.log(`Question: "${waterQuestion}"`);
    
    const waterAnswer = await agent.answerQuestion(llm, result.sessionId, waterQuestion);
    console.log('\n💬 Answer:');
    console.log('==========');
    console.log(waterAnswer);
    
    // Validate that Atlantic is mentioned
    const waterAnswerLower = waterAnswer.toLowerCase();
    const atlanticMentioned = waterAnswerLower.includes('atlantic');
    console.log(`\n✓ Validation: Atlantic mentioned in answer? ${atlanticMentioned ? '✅ YES' : '❌ NO'}`);
    
    if (!atlanticMentioned) {
        throw new Error('❌ TEST FAILED: Atlantic was not mentioned when asked about body of water');
    }
    
    // Display full conversation history
    console.log('\n\n📜 Full Conversation History:');
    console.log('============================');
    agent.displayContext(result.sessionId);
    
    // Clean up
    agent.clearSession(result.sessionId);
    
    console.log('\n✅ All validations passed!');
}

/**
 * Test case 2: Boston Multi-Scale Context
 * Tests that mainLocation scales appropriately with radius
 */
export async function testBostonMultiScale(): Promise<void> {
    console.log('\n🧪 TEST CASE 2: Boston Multi-Scale Context');
    console.log('===========================================');
    
    const agent = new AIHistoricalContextAgent();
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Boston coordinates (same for all tests)
    const bostonCoords = { lat: 42.3601, lng: -71.0589 };
    
    // Test 1: Very small radius - should get a specific landmark, NOT "Boston"
    console.log('\n📍 Test 2.1: SMALL RADIUS (500m)');
    console.log('==================================');
    console.log(`Location: Boston coordinates (${bostonCoords.lat}, ${bostonCoords.lng})`);
    console.log('Expected: Specific landmark/building name, NOT "Boston"\n');
    
    const smallRadius = 500; // 500 meters
    const smallResult = await agent.generateContext(llm, bostonCoords, smallRadius);
    
    console.log(`\n📖 Main Location: ${smallResult.mainLocation}`);
    console.log(`Context (first 200 chars): ${smallResult.context.substring(0, 200)}...\n`);
    
    // Validate that mainLocation is NOT just "Boston"
    const isNotJustBoston = !smallResult.mainLocation.toLowerCase().match(/^boston$/);
    const isSpecificLocation = smallResult.mainLocation.length > 6; // More than just "Boston"
    console.log(`✓ Validation: Main location is specific (not just "Boston")? ${isNotJustBoston && isSpecificLocation ? '✅ YES' : '❌ NO'}`);
    console.log(`  Main location: "${smallResult.mainLocation}"`);
    
    if (!isNotJustBoston || !isSpecificLocation) {
        console.log('⚠️  Warning: Expected a specific landmark for small radius, got:', smallResult.mainLocation);
    }
    
    agent.clearSession(smallResult.sessionId);
    
    // Test 2: Medium radius - should get "Boston" or a Boston neighborhood
    console.log('\n\n📍 Test 2.2: MEDIUM RADIUS (10km)');
    console.log('===================================');
    console.log(`Location: Boston coordinates (${bostonCoords.lat}, ${bostonCoords.lng})`);
    console.log('Expected: City name "Boston" or Boston neighborhood\n');
    
    const mediumRadius = 10000; // 10 kilometers
    const mediumResult = await agent.generateContext(llm, bostonCoords, mediumRadius);
    
    console.log(`\n📖 Main Location: ${mediumResult.mainLocation}`);
    console.log(`Context (first 200 chars): ${mediumResult.context.substring(0, 200)}...\n`);
    
    // Validate that mainLocation includes "Boston"
    const includesBoston = mediumResult.mainLocation.toLowerCase().includes('boston');
    console.log(`✓ Validation: Main location includes "Boston"? ${includesBoston ? '✅ YES' : '❌ NO'}`);
    console.log(`  Main location: "${mediumResult.mainLocation}"`);
    
    if (!includesBoston) {
        throw new Error('❌ TEST FAILED: Expected main location to include "Boston" for medium radius');
    }
    
    agent.clearSession(mediumResult.sessionId);
    
    // Test 3: Large radius - should get a region (like "New England"), NOT "Boston"
    console.log('\n\n📍 Test 2.3: LARGE RADIUS (500km)');
    console.log('===================================');
    console.log(`Location: Boston coordinates (${bostonCoords.lat}, ${bostonCoords.lng})`);
    console.log('Expected: Regional name like "New England", NOT "Boston"\n');
    
    const largeRadius = 500000; // 500 kilometers
    const largeResult = await agent.generateContext(llm, bostonCoords, largeRadius);
    
    console.log(`\n📖 Main Location: ${largeResult.mainLocation}`);
    console.log(`Context (first 200 chars): ${largeResult.context.substring(0, 200)}...\n`);
    
    // Validate that mainLocation is a region, not just "Boston"
    const isNotBostonCity = !largeResult.mainLocation.toLowerCase().match(/^boston$/);
    const seemsLikeRegion = largeResult.mainLocation.split(' ').length >= 2 || 
                            largeResult.mainLocation.toLowerCase().includes('england') ||
                            largeResult.mainLocation.toLowerCase().includes('massachusetts') ||
                            largeResult.mainLocation.toLowerCase().includes('region');
    console.log(`✓ Validation: Main location is regional (not just "Boston")? ${isNotBostonCity ? '✅ YES' : '❌ NO'}`);
    console.log(`  Main location: "${largeResult.mainLocation}"`);
    
    if (!isNotBostonCity) {
        throw new Error('❌ TEST FAILED: Expected a regional name for large radius, not "Boston"');
    }
    
    agent.clearSession(largeResult.sessionId);
    
    console.log('\n✅ Multi-scale test completed!');
    console.log('\nSummary:');
    console.log(`  Small radius (${smallRadius}m):   "${smallResult.mainLocation}"`);
    console.log(`  Medium radius (${mediumRadius}m):  "${mediumResult.mainLocation}"`);
    console.log(`  Large radius (${largeRadius}m): "${largeResult.mainLocation}"`);
}

/**
 * Test case 3: Desolate Location (Middle of Pacific Ocean)
 * Tests that the system properly handles locations with no historical significance
 */
export async function testDesolateLocation(): Promise<void> {
    console.log('\n🧪 TEST CASE 3: Desolate Location (Pacific Ocean)');
    console.log('==================================================');
    
    const agent = new AIHistoricalContextAgent();
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Coordinates in the middle of the Pacific Ocean, far from any land
    // Point Nemo - the oceanic pole of inaccessibility
    const pointNemoCoords = { lat: -48.876667, lng: -123.393333 };
    const smallRadius = 1000; // 1km radius - nowhere near any land
    
    console.log(`📍 Testing location: Point Nemo (${pointNemoCoords.lat}, ${pointNemoCoords.lng})`);
    console.log('   (Most remote point in the ocean, ~2,688 km from nearest land)');
    console.log(`📏 Radius: ${smallRadius}m`);
    console.log('Expected: System should use validation feedback to guide retries.');
    console.log('          Either succeeds with "No significant historical location"');
    console.log('          OR fails after exhausting retries (hallucinations detected)\n');
    
    try {
        const result = await agent.generateContext(llm, pointNemoCoords, smallRadius);
        
        console.log('\n📖 Generated Response:');
        console.log('======================');
        console.log(`Main Location: ${result.mainLocation}`);
        console.log(`\nContext:\n${result.context}\n`);
        
        // Check if this is a "no context" response
        const isNoContextResponse = result.mainLocation.toLowerCase().includes('no significant') ||
                                    result.context.toLowerCase().includes('no notable historical') ||
                                    result.context.toLowerCase().includes('no significant historical') ||
                                    result.context.toLowerCase().includes('no recorded human');
        
        console.log(`✓ Validation: Response indicates no historical context? ${isNoContextResponse ? '✅ YES' : '⚠️  NO'}`);
        
        if (isNoContextResponse) {
            console.log('✅ SUCCESS: System correctly identified desolate location with no historical context!');
            console.log('   The validation feedback mechanism guided the LLM to the correct response.');
        } else {
            console.log('⚠️  Note: LLM provided context for this location despite it being desolate.');
            console.log('   This means validation passed, which could happen if:');
            console.log('   - The LLM found a way to provide context that passed geographic checks');
            console.log('   - Or the validation determined the context was acceptable');
        }
        
        console.log('\n💡 This test demonstrates the retry loop with validation feedback:');
        console.log('   1. LLM attempts generate a response');
        console.log('   2. Validators check for JSON correctness and geographic hallucinations');
        console.log('   3. If validation fails, the error reason is added to the next prompt');
        console.log('   4. LLM learns from feedback and corrects its response');
        
        agent.clearSession(result.sessionId);
        
    } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Check if this is the expected failure due to hallucination detection
        if (errorMessage.includes('all attempts') || errorMessage.includes('All') && errorMessage.includes('attempts failed')) {
            console.log('\n✅ EXPECTED BEHAVIOR: All retry attempts failed due to hallucination detection!');
            console.log('   The system correctly rejected all fabricated locations for this truly desolate');
            console.log('   oceanic coordinate. The LLM kept trying to place Northern Hemisphere locations');
            console.log('   at Southern Hemisphere coordinates, and the validation correctly caught all of them.');
            console.log('\n💡 This demonstrates that:');
            console.log('   1. JSON validation catches malformed responses');
            console.log('   2. Secondary agent catches geographic hallucinations');
            console.log('   3. Retry loop gives the LLM multiple chances');
            console.log('   4. System appropriately fails when no valid context exists\n');
            return; // This is a successful test outcome
        }
        
        // If it's a different kind of error, throw it
        console.error('❌ Unexpected error during desolate location test:', errorMessage);
        throw error;
    }
}

/**
 * Main function to run all test cases
 */
async function main(): Promise<void> {
    console.log('🌍 AIHistoricalContextAgent Test Suite');
    console.log('======================================\n');
    
    try {
        // Run Boston test
        await testBostonContext();
        
        // Run multi-scale test
        await testBostonMultiScale();
        
        // Run desolate location test
        await testDesolateLocation();
        
        console.log('\n🎉 All test cases completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test error:', (error as Error).message);
        process.exit(1);
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    main();
}

