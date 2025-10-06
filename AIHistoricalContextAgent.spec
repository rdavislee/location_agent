<concept_spec>

Concept AIHistoricalContextAgent

Purpose: generate location-aware historical narratives

Principle: 
    given a location and radius, synthesize relevant historical information into engaging context;
    answer follow-up questions grounded in that context

State:

    A set of ActiveContexts with:
    A sessionId String
    A baseContext String (the generated historical narrative)
    A location Coordinates
    A radius Number

Actions:

    generateContext(location: Coordinates, radius: Number): (context: String, mainLocation: String, sessionId: String)
    Requires: valid coordinates and positive radius
    Effects: AI generates narrative context, identifies most significant location as mainLocation, creates ActiveContext with new sessionId
    Returns: context narrative, main location name, session id

    answerQuestion(sessionId: String, question: String): (answer: String)
    Requires: ActiveContext exists with sessionId
    Effects: AI Generates answer based on baseContext and question, adds question/answer pair to base context
    Returns: answer grounded in historical context

    clearSession(sessionId: String)
    Requires: ActiveContext exists with sessionId
    Effects: Removes ActiveContext from set

</concept_spec>