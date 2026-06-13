import Graph from "graphology";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { degreeCentrality } from "graphology-metrics/centrality/degree.js";
import betweenness from "graphology-metrics/centrality/betweenness.js";
import pagerank from "graphology-metrics/centrality/pagerank.js";

const BASE = import.meta.env.BASE_URL;

// Module-scope state — reassigned on every buildGraph()
let graph, renderer, fa2Worker, nodeMetrics, sortedNodes;
let physicsRunning = true;
let animRevealedNodes = null, animInterval = null, animIndex = 0;
let highlightedNodes = new Set(), highlightedEdges = new Set();
let firstDegreeNodes = new Set(), secondDegreeNodes = new Set();

const fa2Settings = {
  barnesHutOptimize: true,
  barnesHutTheta: 0.5,
  gravity: 0.05,
  scalingRatio: 400,
  strongGravityMode: false,
  linLogMode: false,
  adjustSizes: true,
  slowDown: 12,
};

// DOM refs (stable)
const animBtn = document.getElementById("animateButton");
const animCounter = document.getElementById("animateCounter");
const animSpeedSlider = document.getElementById("animateSpeed");
const physicsBtn = document.getElementById("physicsButton");

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

function getStepDelay() {
  const isMobile = window.innerWidth <= 640;
  const speed = isMobile ? 10 : parseInt(animSpeedSlider.value);
  return Math.round(600 - (speed - 1) * (580 / 9));
}

function getNeighborhood(nodeId, degreeLimit) {
  const first = new Set();
  const second = new Set();
  const visited = new Set([nodeId]);

  graph.neighbors(nodeId).forEach(n => { first.add(n); visited.add(n); });

  if (degreeLimit >= 2) {
    first.forEach(n1 => {
      graph.neighbors(n1).forEach(n2 => {
        if (!visited.has(n2)) { second.add(n2); visited.add(n2); }
      });
    });
  }

  return { firstDegree: first, secondDegree: second };
}

function resetNodeAppearance() {
  renderer.setSetting("nodeReducer", null);
  renderer.setSetting("edgeReducer", null);
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
    if (highlightedNodes.has(src) && highlightedNodes.has(tgt)) highlightedEdges.add(edge);
  });

  renderer.setSetting("nodeReducer", (node, data) => {
    const res = { ...data };
    if (node === nodeId) {
      res.color = "#ef4444"; res.zIndex = 2; res.highlighted = true;
    } else if (firstDegreeNodes.has(node)) {
      res.color = "#4caf50"; res.zIndex = 1;
    } else if (secondDegreeNodes.has(node)) {
      res.color = "#ffc107"; res.zIndex = 1;
    } else {
      res.color = "#e5e7eb"; res.label = null; res.zIndex = 0;
    }
    return res;
  });

  renderer.setSetting("edgeReducer", (edge, data) => {
    const res = { ...data };
    if (!highlightedEdges.has(edge)) { res.color = "#f0f0f0"; res.hidden = true; }
    return res;
  });

  renderer.refresh();

  const episodes = [{ id: nodeId, label: graph.getNodeAttribute(nodeId, "titulo") }];
  firstDegree.forEach(n => episodes.push({ id: n, label: graph.getNodeAttribute(n, "titulo") }));
  displayEpisodeList(episodes);
  displayNodeInfo(nodeId);
}

function pauseAnimation() {
  clearInterval(animInterval);
  animInterval = null;
  animBtn.textContent = "▶ Continuar";
  animBtn.classList.remove("playing");
}

function stopAnimation(reset = true) {
  if (animInterval) { clearInterval(animInterval); animInterval = null; }
  animBtn.textContent = "▶ Animar";
  animBtn.classList.remove("playing");
  if (reset) {
    animRevealedNodes = null;
    animIndex = 0;
    animCounter.textContent = "";
    renderer.setSetting("nodeReducer", null);
    renderer.setSetting("edgeReducer", null);
    renderer.refresh();
  }
}

function resumeAnimation() {
  renderer.setSetting("nodeReducer", (node, data) => {
    if (!animRevealedNodes.has(node)) return { ...data, hidden: true, label: null };
    return data;
  });
  renderer.setSetting("edgeReducer", (edge, data) => {
    const src = graph.source(edge);
    const tgt = graph.target(edge);
    if (!animRevealedNodes.has(src) || !animRevealedNodes.has(tgt)) return { ...data, hidden: true };
    return data;
  });
  renderer.refresh();
  animBtn.textContent = "⏸︎ Pausar";
  animBtn.classList.add("playing");
  animInterval = setInterval(stepAnimation, getStepDelay());
}

function stepAnimation() {
  if (animIndex >= sortedNodes.length) {
    stopAnimation(false);
    animCounter.textContent = `Concluído (${sortedNodes.length} nós)`;
    return;
  }
  const node = sortedNodes[animIndex];
  const revealedNeighbors = graph.neighbors(node).filter(n => animRevealedNodes.has(n));
  if (revealedNeighbors.length > 0) {
    let cx = 0, cy = 0;
    revealedNeighbors.forEach(n => { cx += graph.getNodeAttribute(n, "x"); cy += graph.getNodeAttribute(n, "y"); });
    cx /= revealedNeighbors.length; cy /= revealedNeighbors.length;
    graph.setNodeAttribute(node, "x", cx + (Math.random() - 0.5) * 20);
    graph.setNodeAttribute(node, "y", cy + (Math.random() - 0.5) * 20);
  }
  animRevealedNodes.add(node);
  animIndex++;
  animCounter.textContent = `${animIndex} / ${sortedNodes.length}`;
  renderer.refresh();
}

function startAnimation() {
  highlightNode(null);
  animRevealedNodes = new Set();
  animIndex = 0;

  renderer.setSetting("nodeReducer", (node, data) => {
    if (!animRevealedNodes.has(node)) return { ...data, hidden: true, label: null };
    return data;
  });
  renderer.setSetting("edgeReducer", (edge, data) => {
    const src = graph.source(edge);
    const tgt = graph.target(edge);
    if (!animRevealedNodes.has(src) || !animRevealedNodes.has(tgt)) return { ...data, hidden: true };
    return data;
  });

  animBtn.textContent = "⏸︎ Pausar";
  animBtn.classList.add("playing");
  animInterval = setInterval(stepAnimation, getStepDelay());
}

function displayEpisodeList(episodes) {
  const div = document.getElementById("episodeList");
  if (!episodes.length) { div.style.display = "none"; return; }
  episodes.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  let html = "<table><thead><tr><th>ID do Episodio</th><th>Titulo do Episodio</th></tr></thead><tbody>";
  episodes.forEach(ep => { html += `<tr><td>${ep.id}</td><td>${ep.label}</td></tr>`; });
  html += "</tbody></table>";
  div.style.display = "block";
  div.innerHTML = html;
}

function displayNodeInfo(nodeId) {
  const div = document.getElementById("nodeInfoContent");
  if (!nodeId) { div.innerHTML = "<p>Clique ou pesquise um no no grafo para ver suas metricas.</p>"; return; }
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
    <small>O <strong>coeficiente de agrupamento</strong> mede o quao conectados os vizinhos deste no estao entre si.</small>
    <small>Ver mais em <a href="https://pt.wikipedia.org/wiki/Coeficiente_de_agrupamento">Wikipedia</a></small>
  `;
}

function renderRanking() {
  const rankingSort = document.getElementById("rankingSort");
  const rankingSearch = document.getElementById("rankingSearch");
  const sortKey = rankingSort.value;
  const query = rankingSearch.value.trim().toLowerCase();

  let rows = [];
  nodeMetrics.forEach((m, id) => {
    const titulo = graph.getNodeAttribute(id, "titulo");
    if (query && !id.includes(query) && !titulo.toLowerCase().includes(query)) return;
    rows.push({ id, titulo, ...m });
  });
  rows.sort((a, b) => b[sortKey] - a[sortKey]);

  const div = document.getElementById("rankingList");
  if (!rows.length) { div.innerHTML = "<p style='padding:1rem'>Nenhum episódio encontrado.</p>"; return; }

  let html = `<table><thead><tr>
    <th>#</th><th>Ep</th><th>Título</th>
    <th title="Grau total de conexões">Centralidade</th>
    <th title="Quantos nós apontam para este">Entrada</th>
    <th title="Quantos nós este aponta">Saída</th>
    <th title="Importância ponderada pela relevância de quem cita">PageRank</th>
    <th title="Frequência com que este nó aparece nos menores caminhos entre outros pares">Betweenness</th>
  </tr></thead><tbody>`;
  rows.forEach((r, i) => {
    html += `<tr><td>${i + 1}</td><td>${r.id}</td><td>${r.titulo}</td>
      <td>${r.degree}</td><td>${r.inDegree}</td><td>${r.outDegree}</td>
      <td>${r.pagerank.toFixed(4)}</td><td>${r.betweenness.toFixed(4)}</td></tr>`;
  });
  html += "</tbody></table>";
  div.innerHTML = html;
}

function buildGraph(nodesData, edgesData) {
  // Teardown previous instance
  if (animInterval) { clearInterval(animInterval); animInterval = null; }
  if (fa2Worker) fa2Worker.stop();
  if (renderer) renderer.kill();

  // Reset state
  animRevealedNodes = null;
  animIndex = 0;
  animCounter.textContent = "";
  animBtn.textContent = "▶ Animar";
  animBtn.classList.remove("playing");
  physicsRunning = true;
  physicsBtn.textContent = "⏸︎ Pausar";
  physicsBtn.classList.remove("paused");
  highlightedNodes = new Set();
  highlightedEdges = new Set();
  firstDegreeNodes = new Set();
  secondDegreeNodes = new Set();
  displayEpisodeList([]);
  displayNodeInfo(null);
  document.getElementById("searchMessage").textContent = "";
  document.getElementById("EpNumber").value = "";

  // Build graph
  graph = new Graph({ type: "directed" });

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
        graph.addEdgeWithKey(edgeKey, src, tgt, { color: "#9ca3af", size: 1.5, type: "arrow" });
      }
    }
  });

  forceAtlas2.assign(graph, { iterations: 300, settings: fa2Settings });

  // Metrics
  degreeCentrality(graph);
  graph.forEachNode(node => {
    graph.setNodeAttribute(node, "size", Math.max(5, 3 + graph.degree(node) * 0.8));
  });

  const pagerankScores = pagerank(graph);
  const betweennessScores = betweenness(graph, { normalized: true });

  nodeMetrics = new Map();
  graph.forEachNode(node => {
    const inDeg = graph.inDegree(node);
    const outDeg = graph.outDegree(node);
    const neighbors = graph.neighbors(node);
    const k = neighbors.length;
    let clustering = 0;
    if (k >= 2) {
      let linkCount = 0;
      for (let i = 0; i < neighbors.length; i++)
        for (let j = i + 1; j < neighbors.length; j++)
          if (graph.hasEdge(neighbors[i], neighbors[j]) || graph.hasEdge(neighbors[j], neighbors[i]))
            linkCount++;
      clustering = (2 * linkCount) / (k * (k - 1));
    }
    nodeMetrics.set(node, {
      degree: k, inDegree: inDeg, outDegree: outDeg, clustering,
      pagerank: pagerankScores[node] ?? 0,
      betweenness: betweennessScores[node] ?? 0,
    });
  });

  sortedNodes = graph.nodes().slice().sort((a, b) => parseInt(a) - parseInt(b));

  // Renderer
  const container = document.getElementById("naruhodo_graph");
  renderer = new Sigma(graph, container, {
    defaultEdgeType: "arrow",
    edgeProgramClasses: { arrow: EdgeArrowProgram },
    labelRenderedSizeThreshold: 12,
    labelSize: 12,
    labelColor: { color: "#374151" },
    nodeReducer: null,
    edgeReducer: null,
    minCameraRatio: 0.05,
    maxCameraRatio: 3,
    zOrder: true,
  });

  // Renderer events (re-added each build since renderer is new)
  renderer.on("clickNode", ({ node }) => {
    if (animInterval) stopAnimation(true);
    const searchMessage = document.getElementById("searchMessage");
    searchMessage.textContent = `Episodio ${node}: ${graph.getNodeAttribute(node, "titulo")}`;
    searchMessage.className = "message";
    document.getElementById("EpNumber").value = node;
    highlightNode(node);
  });

  renderer.on("clickStage", () => {
    highlightNode(null);
    document.getElementById("searchMessage").textContent = "";
  });

  // Physics worker
  fa2Worker = new FA2Layout(graph, { settings: fa2Settings });
  fa2Worker.start();

  renderRanking();
}

async function initGraph() {
  const nodesData = await loadCSV(`${BASE}data/nodes.csv`, ";");
  const edgesData = await loadCSV(`${BASE}data/edges.csv`, ",");

  buildGraph(nodesData, edgesData);

  // Event listeners — set up ONCE, reference module-scope vars
  animBtn.addEventListener("click", () => {
    if (animInterval) {
      pauseAnimation();
    } else if (animRevealedNodes !== null && animIndex < sortedNodes.length) {
      resumeAnimation();
    } else {
      startAnimation();
    }
  });

  animSpeedSlider.addEventListener("input", () => {
    if (animInterval) { clearInterval(animInterval); animInterval = setInterval(stepAnimation, getStepDelay()); }
  });

  physicsBtn.addEventListener("click", () => {
    if (physicsRunning) {
      fa2Worker.stop();
      physicsBtn.textContent = "▶ Retomar";
      physicsBtn.classList.add("paused");
    } else {
      fa2Worker.start();
      physicsBtn.textContent = "⏸︎ Pausar";
      physicsBtn.classList.remove("paused");
    }
    physicsRunning = !physicsRunning;
  });

  document.getElementById("resetLayoutButton").addEventListener("click", () => {
    buildGraph(nodesData, edgesData);
  });

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
    if (!graph.hasNode(targetNode)) targetNode = String(parseInt(epNumber) - 1);
    if (graph.hasNode(targetNode)) {
      highlightNode(targetNode);
      searchMessage.className = "message";
      searchMessage.textContent = `Episodio ${targetNode}: ${graph.getNodeAttribute(targetNode, "titulo")}`;
      const nodePos = renderer.getNodeDisplayData(targetNode);
      if (nodePos) renderer.getCamera().animate({ x: nodePos.x, y: nodePos.y, ratio: 0.3 }, { duration: 750 });
    } else {
      searchMessage.className = "error";
      searchMessage.textContent = `Episodio ${epNumber} nao encontrado`;
    }
  });

  document.getElementById("clearButton").addEventListener("click", () => {
    document.getElementById("searchMessage").textContent = "";
    document.getElementById("EpNumber").value = "";
    highlightNode(null);
  });

  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(tc => (tc.style.display = "none"));
      document.getElementById(tabId).style.display = "block";
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  const rankingSort = document.getElementById("rankingSort");
  const rankingSearch = document.getElementById("rankingSearch");
  rankingSort.addEventListener("change", renderRanking);
  rankingSearch.addEventListener("input", renderRanking);

  document.getElementById("exportCsvButton").addEventListener("click", () => {
    const sortKey = rankingSort.value;
    const query = rankingSearch.value.trim().toLowerCase();
    let rows = [];
    nodeMetrics.forEach((m, id) => {
      const titulo = graph.getNodeAttribute(id, "titulo");
      if (query && !id.includes(query) && !titulo.toLowerCase().includes(query)) return;
      rows.push({ id, titulo, ...m });
    });
    rows.sort((a, b) => b[sortKey] - a[sortKey]);
    const headers = ["Ep", "Titulo", "Centralidade", "Entrada", "Saida", "PageRank", "Betweenness"];
    const csvRows = [headers.join(";")];
    rows.forEach(r => {
      csvRows.push([r.id, `"${r.titulo}"`, r.degree, r.inDegree, r.outDegree,
        r.pagerank.toFixed(4), r.betweenness.toFixed(4)].join(";"));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "naruhodo_metricas.csv"; a.click();
    URL.revokeObjectURL(url);
  });
}

initGraph();
