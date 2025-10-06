/**
 * AIHistoricalContextAgent Concept
 * 
 * Purpose: generate location-aware historical narratives
 * Principle: given a location and radius, synthesize relevant historical information 
 *            into engaging context; answer follow-up questions grounded in that context
 */

import { GeminiLLM } from './gemini-llm';
import { randomUUID } from 'crypto';

// Coordinates representing latitude and longitude
export interface Coordinates {
    lat: number;
    lng: number;
}

// Active context session for a location
export interface ActiveContext {
    sessionId: string;
    location: Coordinates;
    radius: number; // in meters
    conversationHistory: Array<{ prompt: string; response: string }>; // All prompt/response pairs including initial context
    mainLocation: string; // The main location identified during context generation
}

export class AIHistoricalContextAgent {
    private activeContexts: Map<string, ActiveContext> = new Map();
    private maxRetries: number = 3; // Maximum number of retry attempts

    /**
     * Generate historical context for a given location and radius
     * 
     * @param llm - The LLM instance to use for generation
     * @param location - Coordinates of the location
     * @param radius - Radius in meters around the location
     * @returns Object containing context narrative, main location name, and session id
     */
    async generateContext(
        llm: GeminiLLM, 
        location: Coordinates, 
        radius: number
    ): Promise<{ context: string; mainLocation: string; sessionId: string }> {
        // Validate inputs
        if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
            throw new Error('Invalid coordinates provided');
        }
        if (!radius || radius <= 0) {
            throw new Error('Radius must be a positive number');
        }

        console.log(`🌍 Generating historical context for location (${location.lat}, ${location.lng}) with radius ${radius}m...`);

        let basePrompt = this.createContextPrompt(location, radius);
        
        // Retry loop with validation
        let lastError: string = '';
        let validationFeedback: string[] = [];
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`\n🔄 Attempt ${attempt}/${this.maxRetries}...`);
                
                // Add validation feedback from previous attempts to the prompt
                let prompt = basePrompt;
                if (validationFeedback.length > 0) {
                    prompt = basePrompt + `\n\nIMPORTANT - PREVIOUS ATTEMPT(S) FAILED VALIDATION:
${validationFeedback.map((feedback, idx) => `Attempt ${idx + 1}: ${feedback}`).join('\n')}

Please correct these issues in your response. Pay special attention to the validation feedback above.`;
                    console.log('📝 Including validation feedback from previous attempts in prompt');
                }
                
                const response = await llm.executeLLM(prompt);
                
                console.log('✅ Received response from Gemini AI!');
                console.log('\n🤖 RAW GEMINI RESPONSE');
                console.log('======================');
                console.log(response);
                console.log('======================\n');

                // Validate the response
                const validationResult = await this.validateContextResponse(llm, response, location, radius);
                
                if (!validationResult.isValid) {
                    lastError = validationResult.reason || 'Validation failed';
                    validationFeedback.push(lastError); // Store feedback for next attempt
                    console.log(`❌ Attempt ${attempt} failed validation: ${lastError}`);
                    
                    if (attempt < this.maxRetries) {
                        console.log('🔄 Retrying with validation feedback...\n');
                        continue;
                    } else {
                        throw new Error(`All ${this.maxRetries} attempts failed. Last error: ${lastError}`);
                    }
                }

                // Parse the response to extract mainLocation and context
                const parsed = this.parseContextResponse(response);
                
                // Create a new session
                const sessionId = randomUUID();
                const activeContext: ActiveContext = {
                    sessionId,
                    location,
                    radius,
                    mainLocation: parsed.mainLocation,
                    conversationHistory: [
                        {
                            prompt: prompt,
                            response: response
                        }
                    ]
                };
                
                this.activeContexts.set(sessionId, activeContext);
                
                console.log(`✅ Created session ${sessionId} with main location: ${parsed.mainLocation}`);
                console.log(`✅ Successfully generated context after ${attempt} attempt(s)\n`);
                
                return {
                    context: parsed.context,
                    mainLocation: parsed.mainLocation,
                    sessionId
                };
                
            } catch (error) {
                lastError = (error as Error).message;
                validationFeedback.push(lastError); // Store error feedback for next attempt
                console.error(`❌ Attempt ${attempt} error:`, lastError);
                
                if (attempt >= this.maxRetries) {
                    console.error('❌ Error generating historical context after all retries:', lastError);
                    throw error;
                }
                
                console.log('🔄 Retrying with error feedback...\n');
            }
        }
        
        throw new Error(`Failed to generate context after ${this.maxRetries} attempts. Last error: ${lastError}`);
    }

    /**
     * Answer a follow-up question based on the historical context
     * 
     * @param llm - The LLM instance to use for answering
     * @param sessionId - The session ID of the active context
     * @param question - The user's question
     * @returns Answer grounded in the historical context
     */
    async answerQuestion(
        llm: GeminiLLM,
        sessionId: string,
        question: string
    ): Promise<string> {
        // Validate session exists
        const context = this.activeContexts.get(sessionId);
        if (!context) {
            throw new Error(`No active context found for session ${sessionId}`);
        }

        console.log(`💬 Answering question for session ${sessionId}...`);
        console.log(`   Question: "${question}"`);

        const prompt = this.createQuestionPrompt(context, question);
        
        try {
            const answer = await llm.executeLLM(prompt);
            
            console.log('✅ Received answer from Gemini AI!');
            console.log(`   Answer: "${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}"`);

            // Add prompt/response pair to conversation history
            context.conversationHistory.push({ 
                prompt: prompt,
                response: answer 
            });
            
            return answer;
            
        } catch (error) {
            console.error('❌ Error answering question:', (error as Error).message);
            throw error;
        }
    }

    /**
     * Clear a session and remove it from active contexts
     * 
     * @param sessionId - The session ID to clear
     */
    clearSession(sessionId: string): void {
        const context = this.activeContexts.get(sessionId);
        if (!context) {
            throw new Error(`No active context found for session ${sessionId}`);
        }
        
        this.activeContexts.delete(sessionId);
        console.log(`🗑️  Cleared session ${sessionId}`);
    }

    /**
     * Get active context for a session (helper method for inspection)
     */
    getContext(sessionId: string): ActiveContext | undefined {
        return this.activeContexts.get(sessionId);
    }

    /**
     * Get all active session IDs (helper method for inspection)
     */
    getActiveSessions(): string[] {
        return Array.from(this.activeContexts.keys());
    }

    /**
     * Create the prompt for generating historical context
     */
    private createContextPrompt(location: Coordinates, radius: number): string {
        const radiusKm = (radius / 1000).toFixed(2);
        
        // Determine the appropriate scale for the main location based on radius
        let scaleGuidance = '';
        if (radius < 1000) { // Less than 1km
            scaleGuidance = 'Since the radius is very small (< 1km), the "mainLocation" should be a SPECIFIC LANDMARK, BUILDING, or STREET NAME within this area, NOT a city or region name.';
        } else if (radius < 50000) { // 1km to 50km
            scaleGuidance = 'Since the radius is moderate (1-50km), the "mainLocation" should be a CITY, NEIGHBORHOOD, or DISTRICT NAME that best represents this area.';
        } else { // 50km or more
            scaleGuidance = 'Since the radius is large (> 50km), the "mainLocation" should be a REGION, STATE, or LARGE GEOGRAPHICAL AREA NAME (like "New England", "The Bay Area", "Southern California"), NOT a specific city name.';
        }
        
        return `You are a knowledgeable local historian who provides engaging, accurate historical context about locations.

TASK:
Generate a rich historical narrative about the area around coordinates (${location.lat}, ${location.lng}) within a radius of ${radius} meters (${radiusKm} km).

CRITICAL REQUIREMENT FOR MAIN LOCATION:
${scaleGuidance}

REQUIREMENTS:
1. Identify the most historically significant location within this area at the APPROPRIATE SCALE for the radius
2. Provide 2-4 paragraphs of engaging historical context about this area
3. Include:
   - Historical events that occurred in this area
   - Significant buildings, landmarks, or natural features and their history
   - Cultural or social significance of the location
   - How the area has changed over time
4. Write in an accessible, engaging style that makes history come alive
5. Be specific and grounded in real historical facts
6. If this is a less historically documented area (rural, wilderness, etc.), discuss:
   - Indigenous peoples who lived there
   - Natural history and geological features
   - How the land was used historically
   - Any relevant regional history
7. Scale your narrative appropriately:
   - Small radius (< 1km): Focus on specific landmarks and immediate surroundings
   - Medium radius (1-50km): Focus on city/district history and development
   - Large radius (> 50km): Focus on regional history, broader patterns, and major developments

IMPORTANT EXCEPTION - DESOLATE OR INSIGNIFICANT LOCATIONS:
If these coordinates fall in a truly desolate location with no historical significance (e.g., middle of an ocean, uninhabited desert, remote wilderness) AND the radius is not large enough to capture any historically significant areas, then:
- Set "mainLocation" to "No significant historical location"
- Set "context" to a brief statement (1-2 sentences) explaining that there is no notable historical context for this location, such as: "This location does not contain any significant historical landmarks or documented historical events. The area is geographically remote/oceanic/uninhabited with no recorded human historical significance."

Return your response as a JSON object with this exact structure:
{
  "mainLocation": "Name of the location at the appropriate scale for the radius OR 'No significant historical location'",
  "context": "Your engaging historical narrative (2-4 paragraphs) OR brief no-context statement (1-2 sentences)"
}

Return ONLY the JSON object, no additional text.`;
    }

    /**
     * Create the prompt for answering a follow-up question
     */
    private createQuestionPrompt(context: ActiveContext, question: string): string {
        const radiusKm = (context.radius / 1000).toFixed(2);
        
        // Get the initial context from the first conversation entry
        const initialContextResponse = context.conversationHistory[0]?.response || '';
        
        // Parse the initial context to get the narrative text
        let historicalNarrative = '';
        try {
            const jsonMatch = initialContextResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                historicalNarrative = parsed.context || '';
            }
        } catch {
            // If parsing fails, use the raw response
            historicalNarrative = initialContextResponse;
        }
        
        // Include previous Q&A exchanges (skip the first entry which is the initial context)
        const previousQA = context.conversationHistory.slice(1);
        const conversationContext = previousQA.length > 0
            ? `\n\nPREVIOUS CONVERSATION:\n${previousQA
                .map((exchange, index) => {
                    // Extract the question from the prompt (after "USER QUESTION:")
                    const questionMatch = exchange.prompt.match(/USER QUESTION:\s*(.+?)(?:\n|$)/s);
                    const extractedQuestion = questionMatch ? questionMatch[1].trim() : 'Question';
                    return `Q: ${extractedQuestion}\nA: ${exchange.response}`;
                })
                .join('\n\n')}`
            : '';
        
        return `You are a knowledgeable local historian answering questions about a specific location and its surrounding area.

LOCATION CONTEXT:
You are discussing the area around coordinates (${context.location.lat}, ${context.location.lng}) within a radius of ${context.radius} meters (${radiusKm} km).
Main Location: ${context.mainLocation}

HISTORICAL CONTEXT PROVIDED EARLIER:
${historicalNarrative}${conversationContext}

USER QUESTION:
${question}

REQUIREMENTS:
1. Answer the question using your knowledge about this location and the surrounding area
2. You may use information beyond the historical context provided above, as long as it's relevant to this location
3. Be conversational and engaging
4. Provide specific, accurate details about the area
5. When possible, connect your answer to the historical context or previous discussion
6. If the question is about something in this general area (like schools, landmarks, geography, etc.), answer based on your knowledge of the region

Return ONLY your answer as plain text, no additional formatting or labels.`;
    }

    /**
     * Validate the LLM response for correctness and hallucinations
     * Returns true if valid, false if should retry
     */
    private async validateContextResponse(
        llm: GeminiLLM,
        responseText: string,
        location: Coordinates,
        radius: number
    ): Promise<{ isValid: boolean; reason?: string }> {
        console.log('🔍 Validating LLM response...');
        
        // Step 1: Validate JSON structure
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { isValid: false, reason: 'No JSON found in response' };
            }

            const response = JSON.parse(jsonMatch[0]);
            
            if (!response.mainLocation || typeof response.mainLocation !== 'string') {
                return { isValid: false, reason: 'Missing or invalid mainLocation field' };
            }
            
            if (!response.context || typeof response.context !== 'string') {
                return { isValid: false, reason: 'Missing or invalid context field' };
            }

            // Check if it's a "no context" response - these are valid and don't need hallucination check
            const isNoContextResponse = response.mainLocation === "No significant historical location" ||
                                       response.mainLocation.toLowerCase().includes("no significant");
            
            if (isNoContextResponse) {
                console.log('✅ Valid "no context" response - skipping hallucination check');
                return { isValid: true };
            }

            // Step 2: Use secondary agent to check for hallucinations
            console.log('🤖 Running secondary agent hallucination check...');
            const hallucinationCheckPrompt = this.createHallucinationCheckPrompt(
                location,
                radius,
                response.mainLocation,
                response.context
            );
            
            const hallucinationCheckResponse = await llm.executeLLM(hallucinationCheckPrompt);
            
            console.log('📝 Hallucination check result:', hallucinationCheckResponse.substring(0, 100));
            
            // Parse the hallucination check response
            const checkResult = this.parseHallucinationCheckResponse(hallucinationCheckResponse);
            
            if (!checkResult.isValid) {
                console.log(`⚠️  Hallucination detected: ${checkResult.reason}`);
                return { isValid: false, reason: checkResult.reason };
            }
            
            console.log('✅ Response passed all validation checks');
            return { isValid: true };
            
        } catch (error) {
            return { isValid: false, reason: `Validation error: ${(error as Error).message}` };
        }
    }

    /**
     * Create prompt for hallucination checking by secondary agent
     */
    private createHallucinationCheckPrompt(
        location: Coordinates,
        radius: number,
        mainLocation: string,
        context: string
    ): string {
        const radiusKm = (radius / 1000).toFixed(2);
        
        return `You are a fact-checking AI assistant. Your job is to review historical information for accuracy and detect hallucinations or fabrications.

LOCATION INFORMATION:
Coordinates: (${location.lat}, ${location.lng})
Radius: ${radius} meters (${radiusKm} km)

CLAIMED MAIN LOCATION:
"${mainLocation}"

HISTORICAL CONTEXT PROVIDED:
${context}

YOUR TASK:
You MUST determine if the claimed location matches the given coordinates. Be EXTREMELY STRICT.

CRITICAL CHECKS (in order):

1. HEMISPHERE CHECK (MOST IMPORTANT):
   - Latitude ${location.lat} is ${location.lat >= 0 ? 'POSITIVE (Northern Hemisphere)' : 'NEGATIVE (Southern Hemisphere)'}
   - Does "${mainLocation}" exist in the ${location.lat >= 0 ? 'Northern' : 'Southern'} Hemisphere?
   - If the claimed location is actually in the opposite hemisphere, this is a HALLUCINATION
   - Examples:
     * Boston, MA is at +42.3° (Northern), NOT -42.3° (Southern)  
     * Olympia, WA is at +47.0° (Northern), NOT -48.0° (Southern)
     * Victoria, BC is at +48.4° (Northern), NOT -48.4° (Southern)

2. OCEANIC LOCATION CHECK:
   - If |latitude| > 45° AND the radius is < 50km, check if this could be in open ocean
   - Coordinates near (-48, -123) with small radius are in the MIDDLE OF THE PACIFIC OCEAN
   - If coordinates are in an ocean with small radius, claiming any land-based location is a HALLUCINATION

3. DISTANCE VERIFICATION:
   - Is the claimed location actually within ${(radius / 1000).toFixed(0)}km of (${location.lat}, ${location.lng})?
   - If not, this is a HALLUCINATION

4. FABRICATED LOCATIONS:
   - Does the location actually exist where claimed?

IMPORTANT: If the coordinates are in the wrong hemisphere from the claimed location, you MUST mark it as invalid. This is a severe hallucination.

Return your response as a JSON object with this exact structure:
{
  "isValid": true/false,
  "reason": "Brief explanation of your determination (1-2 sentences). If valid, explain why. If invalid, explain what hallucination was detected."
}

Return ONLY the JSON object, no additional text.`;
    }

    /**
     * Parse the hallucination check response
     */
    private parseHallucinationCheckResponse(responseText: string): { isValid: boolean; reason: string } {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                // If we can't parse the response, assume valid to avoid blocking legitimate responses
                return { isValid: true, reason: 'Could not parse hallucination check response' };
            }

            const response = JSON.parse(jsonMatch[0]);
            
            return {
                isValid: response.isValid === true,
                reason: response.reason || 'No reason provided'
            };
        } catch (error) {
            // If parsing fails, assume valid to avoid blocking legitimate responses
            return { isValid: true, reason: 'Error parsing hallucination check response' };
        }
    }

    /**
     * Parse the LLM response for context generation
     */
    private parseContextResponse(responseText: string): { context: string; mainLocation: string } {
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const response = JSON.parse(jsonMatch[0]);
            
            // Validate response structure
            if (!response.mainLocation || typeof response.mainLocation !== 'string') {
                throw new Error('Response missing valid mainLocation field');
            }
            
            if (!response.context || typeof response.context !== 'string') {
                throw new Error('Response missing valid context field');
            }

            // Validate content quality
            const isNoContextResponse = response.mainLocation === "No significant historical location" ||
                                       response.mainLocation.toLowerCase().includes("no significant");
            
            if (!isNoContextResponse && response.context.length < 100) {
                throw new Error('Historical context is too short (minimum 100 characters expected)');
            }

            if (response.mainLocation.trim().length === 0) {
                throw new Error('Main location cannot be empty');
            }

            if (isNoContextResponse) {
                console.log('✅ Successfully validated response (no historical context at this location)');
            } else {
                console.log('✅ Successfully validated historical context response');
            }
            
            return {
                context: response.context.trim(),
                mainLocation: response.mainLocation.trim()
            };
            
        } catch (error) {
            console.error('❌ Error parsing LLM response:', (error as Error).message);
            console.log('Response was:', responseText);
            throw error;
        }
    }

    /**
     * Display the current context in a readable format
     */
    displayContext(sessionId: string): void {
        const context = this.activeContexts.get(sessionId);
        if (!context) {
            console.log(`❌ No active context found for session ${sessionId}`);
            return;
        }

        console.log('\n📍 Historical Context');
        console.log('===================');
        console.log(`Session: ${sessionId}`);
        console.log(`Location: (${context.location.lat}, ${context.location.lng})`);
        console.log(`Radius: ${context.radius}m`);
        console.log(`Main Location: ${context.mainLocation}`);
        
        if (context.conversationHistory.length > 0) {
            console.log('\n💬 Conversation History:');
            console.log('========================');
            
            // Display initial context generation
            const initialResponse = context.conversationHistory[0];
            console.log('\n[Initial Context Generation]');
            try {
                const jsonMatch = initialResponse.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log(parsed.context);
                }
            } catch {
                console.log(initialResponse.response);
            }
            
            // Display follow-up Q&A exchanges
            const followUpExchanges = context.conversationHistory.slice(1);
            if (followUpExchanges.length > 0) {
                console.log('\n[Follow-up Questions]');
                followUpExchanges.forEach((exchange, index) => {
                    // Extract question from the prompt
                    const questionMatch = exchange.prompt.match(/USER QUESTION:\s*(.+?)(?:\n|$)/s);
                    const question = questionMatch ? questionMatch[1].trim() : 'Question';
                    console.log(`\n[${index + 1}] Q: ${question}`);
                    console.log(`    A: ${exchange.response}`);
                });
            }
        }
    }
}

