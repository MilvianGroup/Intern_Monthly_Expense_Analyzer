/**
 * Mermaid Export for LangGraph Studio
 * 
 * This file exports the mermaid diagram from mermaid_workflow.json
 * in a format that LangGraph CLI can understand.
 */

const fs = require('fs');
const path = require('path');

// Read the mermaid_workflow.json file
const mermaidWorkflowPath = path.join(__dirname, '../mermaid_workflow.json');
const mermaidWorkflow = JSON.parse(fs.readFileSync(mermaidWorkflowPath, 'utf8'));

// Create a graph object that LangGraph CLI can understand
const graph = {
  name: mermaidWorkflow.name,
  description: mermaidWorkflow.description,
  mermaid: mermaidWorkflow.mermaid,
  nodes: mermaidWorkflow.nodes,
  state: mermaidWorkflow.state
};

// Export the graph
module.exports = {
  mermaidGraph: graph
};
