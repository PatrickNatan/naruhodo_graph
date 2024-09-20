var nodes = new vis.DataSet(nodes);
var edges = new vis.DataSet(edges);
var network;
var allNodes;
var highlightActive = false;
function redrawAll() {
  const container = document.getElementById("naruhodo_graph");

  var data = {
    nodes: nodes,
    edges: edges,
  };

  var options = {
    layout: {
      improvedLayout: false,
    },
    nodes: {
      shape: "dot",
      size: 16,
      color: "#87CEEB",
    },
    edges: {
      width: 2,
      arrows: "to",
    },
    physics: {
      solver: "forceAtlas2Based",
      timestep: 0.5,
      maxVelocity: 150,
      stabilization: { iterations: 100 },
    },
  };

  allNodes = nodes.get({ returnType: "Object" });

  network = new vis.Network(container, data, options);

  network.on("click", neighbourhoodHighlight);
}

function search() {
  const epNumber = document.getElementById("EpNumber").value;
  const convertToNode = { nodes: [parseInt(epNumber)] }
  neighbourhoodHighlight(convertToNode)
}
function neighbourhoodHighlight(params) {
  console.log(params)
  highlightActive = true;
  var i, j;
  var selectedNode = params.nodes[0];
  var degrees = 2;

  // mark all nodes as hard to read.
  for (var nodeId in allNodes) {
    allNodes[nodeId].color = "rgba(200,200,200,0.5)";
    if (allNodes[nodeId].hiddenLabel === undefined) {
      allNodes[nodeId].hiddenLabel = allNodes[nodeId].label;
      allNodes[nodeId].label = undefined;
    }
  }
  var connectedNodes = network.getConnectedNodes(selectedNode);
  var allConnectedNodes = [];
  // if something is selected:
  if (params.nodes.length > 0) {
    highlightActive = true;
    var i, j;
    var selectedNode = params.nodes[0];
    var degrees = 2;

    // mark all nodes as hard to read.
    for (var nodeId in allNodes) {
      allNodes[nodeId].color = "rgba(200,200,200,0.5)";
      if (allNodes[nodeId].hiddenLabel === undefined) {
        allNodes[nodeId].hiddenLabel = allNodes[nodeId].label;
        allNodes[nodeId].label = undefined;
      }
    }
    var connectedNodes = network.getConnectedNodes(selectedNode);
    var allConnectedNodes = [];

    // get the second degree nodes
    for (i = 1; i < degrees; i++) {
      for (j = 0; j < connectedNodes.length; j++) {
        allConnectedNodes = allConnectedNodes.concat(
          network.getConnectedNodes(connectedNodes[j])
        );
      }
    }

    // all second degree nodes get a different color and their label back
    for (i = 0; i < allConnectedNodes.length; i++) {
      allNodes[allConnectedNodes[i]].color = "rgba(106,90,205,0.3)";
      if (allNodes[allConnectedNodes[i]].hiddenLabel !== undefined) {
        allNodes[allConnectedNodes[i]].label =
          allNodes[allConnectedNodes[i]].hiddenLabel;
        allNodes[allConnectedNodes[i]].hiddenLabel = undefined;
      }
    }

    // all first degree nodes get their own color and their label back
    for (i = 0; i < connectedNodes.length; i++) {
      allNodes[connectedNodes[i]].color = undefined;
      if (allNodes[connectedNodes[i]].hiddenLabel !== undefined) {
        allNodes[connectedNodes[i]].label =
          allNodes[connectedNodes[i]].hiddenLabel;
        allNodes[connectedNodes[i]].hiddenLabel = undefined;
      }
    }

    // the main node gets its own color and its label back.
    allNodes[selectedNode].color = "rgba(255, 0, 0, 1)";
    if (allNodes[selectedNode].hiddenLabel !== undefined) {
      allNodes[selectedNode].label = allNodes[selectedNode].hiddenLabel;
      allNodes[selectedNode].hiddenLabel = undefined;
    }
  } else if (highlightActive == true) {
    // reset all nodes
    for (var nodeId in allNodes) {
      allNodes[nodeId].color = "#87CEEB";
      if (allNodes[nodeId].hiddenLabel !== undefined) {
        allNodes[nodeId].label = allNodes[nodeId].hiddenLabel;
        allNodes[nodeId].hiddenLabel = undefined;
      }
    }
    highlightActive = false;
  }

  // transform the object into an array
  var updateArray = [];
  for (nodeId in allNodes) {
    if (allNodes.hasOwnProperty(nodeId)) {
      updateArray.push(allNodes[nodeId]);
    }
  }
  nodes.update(updateArray);
}

redrawAll();