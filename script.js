import Graph from "graphology";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { degreeCentrality } from "graphology-metrics/centrality/degree.js";

const BASE = import.meta.env.BASE_URL;

async function loadCSV(url, delimiter = ",") {
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.trim().split("\n");
  const headers = lines[0].split(delimiter).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(delimiter).map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = vals[i]));
    return obj;
  });
}

async function initGraph() {
  const nodesData = await loadCSV(`${BASE}data/nodes.csv`, ";");
  const edgesData = await loadCSV(`${BASE}data/edges.csv`, ",");

  const graph = new Graph({ type: "directed" });

  nodesData.forEach(d => {
    graph.addNode(d.numero, {
      label: `${d.numero}: ${d.titulo}`,
      titulo: d.titulo,
      size: 8,
      color: "#87CEEB",
      x: Math.random() * 100,
      y: Math.random() * 100,
    });
  });

  edgesData.forEach(d => {
    const src = d.ep.trim();
    const tgt = d.referencia.trim();
    if (graph.hasNode(src) && graph.hasNode(tgt)) {
      const edgeKey = `${src}->${tgt}`;
      if (!graph.hasEdge(edgeKey)) {
        graph.addEdgeWithKey(edgeKey, src, tgt, {
          color: "#9ca3af",
          size: 1.5,
          type: "arrow",
        });
      }
    }
  });

  // Pre-compute initial layout (fast settle)
  const fa2Settings = {
    barnesHutOptimize: true,
    barnesHutTheta: 0.5,
    gravity: 0.02,
    scalingRatio: 700,
    strongGravityMode: false,
    linLogMode: false,
    adjustSizes: true,
    slowDown: 1,
  };

  forceAtlas2.assign(graph, { iterations: 500, settings: fa2Settings });

  // Metrics
  degreeCentrality(graph);
  graph.forEachNode(node => {
    const deg = graph.degree(node);
    graph.setNodeAttribute(node, "size", Math.max(5, 3 + deg * 0.8));
  });

  // Calculate detailed metrics per node
  const nodeMetrics = new Map();
  graph.forEachNode(node => {
    const inDeg = graph.inDegree(node);
    const outDeg = graph.outDegree(node);
    const neighbors = graph.neighbors(node);
    const k = neighbors.length;
    let clustering = 0;

    if (k >= 2) {
      let linkCount = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (graph.hasEdge(neighbors[i], neighbors[j]) || graph.hasEdge(neighbors[j], neighbors[i])) {
            linkCount++;
          }
        }
      }
      clustering = (2 * linkCount) / (k * (k - 1));
    }

    nodeMetrics.set(node, {
      degree: k,
      inDegree: inDeg,
      outDegree: outDeg,
      clustering,
    });
  });

  // Sigma renderer
  const container = document.getElementById("naruhodo_graph");
  const renderer = new Sigma(graph, container, {
    defaultEdgeType: "arrow",
    edgeProgramClasses: {
      arrow: EdgeArrowProgram,
    },
    labelRenderedSizeThreshold: 12,
    labelSize: 12,
    labelColor: { color: "#374151" },
    nodeReducer: null,
    edgeReducer: null,
    minCameraRatio: 0.05,
    maxCameraRatio: 3,
  });


  // State
  let highlightedNodes = new Set();
  let highlightedEdges = new Set();
  let firstDegreeNodes = new Set();
  let secondDegreeNodes = new Set();

  function getNeighborhood(nodeId, degreeLimit) {
    const first = new Set();
    const second = new Set();
    const visited = new Set([nodeId]);

    const neighbors = graph.neighbors(nodeId);
    neighbors.forEach(n => {
      first.add(n);
      visited.add(n);
    });

    if (degreeLimit >= 2) {
      first.forEach(n1 => {
        graph.neighbors(n1).forEach(n2 => {
          if (!visited.has(n2)) {
            second.add(n2);
            visited.add(n2);
          }
        });
      });
    }

    return { firstDegree: first, secondDegree: second };
  }

  function highlightNode(nodeId) {
    if (nodeId === null) {
      highlightedNodes.clear();
      highlightedEdges.clear();
      firstDegreeNodes.clear();
      secondDegreeNodes.clear();
      resetNodeAppearance();
      renderer.refresh();
      displayEpisodeList([]);
      displayNodeInfo(null);
      return;
    }

    const { firstDegree, secondDegree } = getNeighborhood(nodeId, 2);
    firstDegreeNodes = firstDegree;
    secondDegreeNodes = secondDegree;

    highlightedNodes = new Set([nodeId, ...firstDegree, ...secondDegree]);

    highlightedEdges = new Set();
    graph.forEachEdge((edge, attrs, src, tgt) => {
      const srcIn = highlightedNodes.has(src);
      const tgtIn = highlightedNodes.has(tgt);
      if (srcIn && tgtIn) {
        highlightedEdges.add(edge);
      }
    });

    renderer.setSetting("nodeReducer", (node, data) => {
      const res = { ...data };
      if (node === nodeId) {
        res.color = "#ef4444";
        res.zIndex = 2;
        res.highlighted = true;
      } else if (firstDegreeNodes.has(node)) {
        res.color = "#4caf50";
        res.zIndex = 1;
      } else if (secondDegreeNodes.has(node)) {
        res.color = "#ffc107";
        res.zIndex = 1;
      } else {
        res.color = "#e5e7eb";
        res.label = null;
        res.zIndex = 0;
      }
      return res;
    });

    renderer.setSetting("edgeReducer", (edge, data) => {
      const res = { ...data };
      if (!highlightedEdges.has(edge)) {
        res.color = "#f0f0f0";
        res.hidden = true;
      }
      return res;
    });

    renderer.refresh();

    // Episode list
    const episodes = [{ id: nodeId, label: graph.getNodeAttribute(nodeId, "titulo") }];
    firstDegree.forEach(n => {
      episodes.push({ id: n, label: graph.getNodeAttribute(n, "titulo") });
    });
    displayEpisodeList(episodes);
    displayNodeInfo(nodeId);
  }

  function resetNodeAppearance() {
    renderer.setSetting("nodeReducer", null);
    renderer.setSetting("edgeReducer", null);
  }

  // Click handler
  renderer.on("clickNode", ({ node }) => {
    const searchMessage = document.getElementById("searchMessage");
    const titulo = graph.getNodeAttribute(node, "titulo");
    searchMessage.textContent = `Episodio ${node}: ${titulo}`;
    searchMessage.className = "message";
    document.getElementById("EpNumber").value = node;
    highlightNode(node);
  });

  renderer.on("clickStage", () => {
    highlightNode(null);
    const searchMessage = document.getElementById("searchMessage");
    searchMessage.textContent = "";
  });

  // Search
  document.getElementById("searchButton").addEventListener("click", () => {
    const searchMessage = document.getElementById("searchMessage");
    searchMessage.textContent = "";
    const epNumber = document.getElementById("EpNumber").value.trim();

    if (!epNumber || isNaN(parseInt(epNumber))) {
      searchMessage.className = "error";
      searchMessage.textContent = "Numero de episodio invalido";
      return;
    }

    let targetNode = epNumber;
    if (!graph.hasNode(targetNode)) {
      targetNode = String(parseInt(epNumber) - 1);
    }

    if (graph.hasNode(targetNode)) {
      highlightNode(targetNode);
      searchMessage.className = "message";
      searchMessage.textContent = `Episodio ${targetNode}: ${graph.getNodeAttribute(targetNode, "titulo")}`;

      // Camera animation to node
      const nodePos = renderer.getNodeDisplayData(targetNode);
      if (nodePos) {
        renderer.getCamera().animate(
          { x: nodePos.x, y: nodePos.y, ratio: 0.3 },
          { duration: 750 }
        );
      }
    } else {
      searchMessage.className = "error";
      searchMessage.textContent = `Episodio ${epNumber} nao encontrado`;
    }
  });

  // Clear
  document.getElementById("clearButton").addEventListener("click", () => {
    const searchMessage = document.getElementById("searchMessage");
    searchMessage.textContent = "";
    document.getElementById("EpNumber").value = "";
    highlightNode(null);
  });

  // Tabs
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(tc => (tc.style.display = "none"));
      document.getElementById(tabId).style.display = "block";
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Display functions
  function displayEpisodeList(episodes) {
    const div = document.getElementById("episodeList");
    if (!episodes.length) {
      div.style.display = "none";
      return;
    }

    episodes.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    let html = "<table><thead><tr><th>ID do Episodio</th><th>Titulo do Episodio</th></tr></thead><tbody>";
    episodes.forEach(ep => {
      html += `<tr><td>${ep.id}</td><td>${ep.label}</td></tr>`;
    });
    html += "</tbody></table>";
    div.style.display = "block";
    div.innerHTML = html;
  }

  function displayNodeInfo(nodeId) {
    const div = document.getElementById("nodeInfoContent");
    if (!nodeId) {
      div.innerHTML = "<p>Clique ou pesquise um no no grafo para ver suas metricas.</p>";
      return;
    }

    const metrics = nodeMetrics.get(nodeId);
    const titulo = graph.getNodeAttribute(nodeId, "titulo");

    div.innerHTML = `
      <h4>Metricas para o Episodio ${nodeId}</h4>
      <p><strong>Titulo:</strong> ${titulo}</p>
      <ul>
        <li><strong>Grau (Total de conexoes):</strong> ${metrics.degree}</li>
        <li><strong>Grau de Entrada (Citacoes Recebidas):</strong> ${metrics.inDegree}</li>
        <li><strong>Grau de Saida (Citacoes Feitas):</strong> ${metrics.outDegree}</li>
        <li><strong>Coeficiente de Agrupamento:</strong> ${metrics.clustering.toFixed(3)}</li>
      </ul>
      <small>O <strong>coeficiente de agrupamento</strong> mede o quao conectados os vizinhos deste no estao entre si. Um valor de 1 significa que todos os vizinhos sao conectados, formando um "clique". Um valor de 0 significa que nenhum vizinho se conecta.</small>
      <small>Ver mais em <a href="https://pt.wikipedia.org/wiki/Coeficiente_de_agrupamento">Wikipedia</a></small>
    `;
  }
}

initGraph();
