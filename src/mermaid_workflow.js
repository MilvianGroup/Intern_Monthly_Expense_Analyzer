/**
 * Mermaid Workflow for LangGraph Studio
 * 
 * This file exports a mermaid diagram that can be used with LangGraph Studio.
 */

// The mermaid diagram from workflow_diagram.md
const mermaidDiagram = `
graph TD
    Start[Start] --> RetrieveExpense[Retrieve Expense Report]
    RetrieveExpense --> AnalyzeExpense[Analyze Expense Data]
    AnalyzeExpense --> CreateVisualization[Create Visualizations]
    CreateVisualization --> PrintSummary[Print Summary]
    PrintSummary --> SendEmailReport[Send Email Report]
    SendEmailReport --> End[End]
    
    subgraph "State"
        State1[expenseReportPath]
        State2[analysisResults]
        State3[visualizationResults]
        State4[emailResult]
        State5[googleDriveMCP]
        State6[gmailMCP]
        State7[isDemoMode]
    end
    
    RetrieveExpense -- Updates --> State1
    AnalyzeExpense -- Updates --> State2
    CreateVisualization -- Updates --> State2
    CreateVisualization -- Updates --> State3
    SendEmailReport -- Updates --> State4
    
    State1 -- Input for --> AnalyzeExpense
    State2 -- Input for --> CreateVisualization
    State2 -- Input for --> SendEmailReport
    State3 -- Input for --> SendEmailReport
    State5 -- Input for --> RetrieveExpense
    State6 -- Input for --> SendEmailReport
    State7 -- Affects --> RetrieveExpense
    State7 -- Affects --> SendEmailReport
`;

// Export the mermaid diagram
module.exports = {
  mermaidWorkflow: mermaidDiagram
};
