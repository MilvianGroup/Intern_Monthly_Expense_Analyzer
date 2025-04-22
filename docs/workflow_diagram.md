# Monthly Financial Project Workflow

This document visualizes the LangGraph workflow for the Monthly Financial Project.

## LangGraph Workflow Diagram

```mermaid
graph TD
    %% Define styles for different node categories
    classDef processNode fill:#4285F4,stroke:#2956A3,color:white,stroke-width:2px
    classDef stateNode fill:#34A853,stroke:#1F7A31,color:white,stroke-width:1px
    classDef endpointNode fill:#EA4335,stroke:#B31412,color:white,stroke-width:2px
    classDef mcpNode fill:#FBBC05,stroke:#E2A403,color:black,stroke-width:1px
    classDef configNode fill:#9C27B0,stroke:#6A1B9A,color:white,stroke-width:1px
    
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
    
    %% Apply styles to nodes
    class Start,End endpointNode
    class RetrieveExpense,AnalyzeExpense,CreateVisualization,PrintSummary,SendEmailReport processNode
    class State1,State2,State3,State4 stateNode
    class State5,State6 mcpNode
    class State7 configNode
```

## Node Descriptions

1. **Retrieve Expense Report**: Fetches expense data from Google Drive or uses sample data in demo mode
2. **Analyze Expense Data**: Processes the expense data to find patterns and generate recommendations
3. **Create Visualizations**: Creates charts and visualizations of the expense data
4. **Print Summary**: Displays a summary of the analysis results
5. **Send Email Report**: Sends the analysis results and visualizations via email

## State Management

The LangGraph workflow maintains state between nodes:

- **expenseReportPath**: Path to the retrieved expense report CSV file
- **analysisResults**: Results of the expense analysis including summary and recommendations
- **visualizationResults**: Paths to generated visualization files
- **emailResult**: Status of the email sending operation
- **googleDriveMCP**: Google Drive MCP instance for file operations
- **gmailMCP**: Gmail MCP instance for sending emails
- **isDemoMode**: Flag indicating if the workflow is running in demo mode

## Benefits of LangGraph

- **Explicit State Management**: State is explicitly defined and passed between nodes
- **Declarative Workflow**: The workflow is defined as a graph with clear node relationships
- **Error Handling**: Each node can handle errors independently
- **Visualization**: The workflow can be visualized as a graph
- **Flexibility**: Nodes can be rearranged or modified without changing the overall structure
