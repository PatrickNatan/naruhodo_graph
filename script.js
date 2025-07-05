const svg = d3.select("#naruhodo_graph svg");
let width = +svg.attr("width") || svg.node().getBoundingClientRect().width;
let height = +svg.attr("height") || svg.node().getBoundingClientRect().height;

const g = svg.append("g");

let graphNodes = [];
let graphLinks = [];
let nodesById = new Map();

async function initGraph() {
  const nodesData = await d3.dsv(";", "data/nodes.csv");
  const edgesData = await d3.csv("data/edges.csv");

  graphNodes = nodesData.map(d => ({
    id: +d.numero,
    label: d.titulo
  }));

  const nodeIds = new Set(graphNodes.map(d => d.id));

  graphLinks = edgesData.map(d => ({
    source: +d.ep,
    target: +d.referencia
  })).filter(link => nodeIds.has(link.source) && nodeIds.has(link.target));

  nodesById = new Map(graphNodes.map(d => [d.id, d]));
  graphLinks.forEach(link => {
    link.source = nodesById.get(link.source);
    link.target = nodesById.get(link.target);
  });

  const simulation = d3.forceSimulation(graphNodes)
    .force("link", d3.forceLink(graphLinks))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("x", d3.forceX())
    .force("y", d3.forceY());

  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "-0 -5 10 10")
    .attr("refX", 18)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 10)
    .attr("markerHeight", 10)
    .attr("xoverflow", "visible")
    .append("svg:path")
    .attr("d", "M 0,-5 L 10 ,0 L 0,5")
    .attr("fill", "#999")
    .style("stroke", "none");

  const link = g.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(graphLinks)
    .enter().append("line")
    .attr("class", "link")
    .attr("stroke-linecap", "round")
    .attr("marker-end", "url(#arrowhead)");

  const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(graphNodes)
    .enter().append("g")
    .attr("class", "node");

  node.append("circle")
    .attr("r", 16)
    .attr("fill", "#87CEEB")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  node.append("text")
    .text(d => d.id)
    .attr("dy", "0.35em")
    .attr("font-size", "10px");

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("transform", d => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function zoomed({ transform }) {
    g.attr("transform", transform);
  }

  const zoom = d3.zoom()
    .scaleExtent([0.1, 2])
    .on("zoom", zoomed);

  svg.call(zoom);

  window.addEventListener('resize', debounce(() => {
    width = svg.node().getBoundingClientRect().width;
    height = svg.node().getBoundingClientRect().height;

    svg.attr("width", width);
    svg.attr("height", height);

    simulation.force("center", d3.forceCenter(width / 2, height / 2));
    simulation.alpha(1).restart();

    svg.call(zoom.transform, d3.zoomIdentity);
  }, 200));

  function debounce(func, delay) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }

  window.dispatchEvent(new Event('resize'));

  const searchInput = d3.select("#EpNumber");
  const searchButton = d3.select("#searchButton");
  const clearButton = d3.select("#clearButton");
  const episodeListDiv = d3.select("#episodeList");
  const nodeInfoDiv = d3.select("#nodeInfoContent");

  let adjacencyList = new Map();

  graphLinks.forEach(link => {
    if (!adjacencyList.has(link.source.id)) {
      adjacencyList.set(link.source.id, []);
    }
    if (!adjacencyList.has(link.target.id)) {
      adjacencyList.set(link.target.id, []);
    }
    adjacencyList.get(link.source.id).push(link.target.id);
    adjacencyList.get(link.target.id).push(link.source.id);
  });

  function calculateNetworkMetrics() {
    graphNodes.forEach(node => {
      node.metrics = { inDegree: 0, outDegree: 0, degree: 0, clustering: 0 };
    });

    graphLinks.forEach(link => {
      const sourceNode = nodesById.get(link.source.id);
      const targetNode = nodesById.get(link.target.id);
      if (sourceNode) sourceNode.metrics.outDegree++;
      if (targetNode) targetNode.metrics.inDegree++;
    });

    graphNodes.forEach(node => {
      const neighbors = adjacencyList.get(node.id) || [];
      node.metrics.degree = neighbors.length;

      if (neighbors.length < 2) {
        node.metrics.clustering = 0;
        return;
      }

      let linkCount = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          const neighborA = neighbors[i];
          const neighborB = neighbors[j];
          const neighborsOfA = adjacencyList.get(neighborA) || [];
          if (neighborsOfA.includes(neighborB)) {
            linkCount++;
          }
        }
      }

      const k = neighbors.length;
      node.metrics.clustering = (k * (k - 1)) > 0 ? (2 * linkCount) / (k * (k - 1)) : 0;
    });
  }

  function getNeighbors(startNodeId, degreeLimit) {
    let visited = new Set();
    let queue = [{ id: startNodeId, degree: 0 }];
    let firstDegreeNeighbors = new Set();
    let secondDegreeNeighbors = new Set();

    visited.add(startNodeId);

    while (queue.length > 0) {
      let { id, degree } = queue.shift();

      if (degree >= degreeLimit) continue;

      const neighbors = adjacencyList.get(id) || [];
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, degree: degree + 1 });
          if (degree + 1 === 1) {
            firstDegreeNeighbors.add(neighborId);
          } else if (degree + 1 === 2) {
            secondDegreeNeighbors.add(neighborId);
          }
        }
      });
    }
    return { firstDegree: firstDegreeNeighbors, secondDegree: secondDegreeNeighbors };
  }

  function neighbourhoodHighlight(selectedNodeId) {
    let episodesToShow = [];
    node.classed("dimmed", false)
      .selectAll("circle")
      .attr("fill", "#87CEEB")
      .classed("highlighted", false)
      .classed("degree1", false)
      .classed("degree2", false);
    node.attr("opacity", 1);
    node.selectAll("text").attr("fill", "#374151").text(d => d.id);

    link.classed("dimmed", false).classed("highlighted", false);
    link.attr("opacity", 1);

    if (selectedNodeId !== null) {
      const { firstDegree, secondDegree } = getNeighbors(selectedNodeId, 2);

      node.classed("dimmed", true).attr("opacity", 0.2);
      node.selectAll("text").attr("fill", "#9ca3af");
      link.classed("dimmed", true).attr("opacity", 0.15);

      node.filter(d => d.id === selectedNodeId)
        .classed("dimmed", false)
        .attr("opacity", 1)
        .select("circle")
        .classed("highlighted", true)
        .attr("fill", "rgba(255, 0, 0, 1)");

      node.filter(d => d.id === selectedNodeId)
        .select("text")
        .text(d => `${d.id}: ${d.label}`)
        .attr("fill", "#374151");
      episodesToShow.push(graphNodes.find(n => n.id === selectedNodeId));

      node.filter(d => firstDegree.has(d.id))
        .classed("dimmed", false)
        .attr("opacity", 1)
        .select("circle")
        .classed("degree1", true)
        .attr("fill", "rgba(106,90,205,0.3)");
      node.filter(d => firstDegree.has(d.id)).select("text").text(d => `${d.id}: ${d.label}`).attr("fill", "#374151");
      firstDegree.forEach(id => episodesToShow.push(graphNodes.find(n => n.id === id)));

      node.filter(d => secondDegree.has(d.id))
        .classed("dimmed", false)
        .attr("opacity", 1)
        .select("circle")
        .classed("degree2", true)
        .attr("fill", "rgba(106,90,205,0.3)");
      node.filter(d => secondDegree.has(d.id)).select("text").text(d => `${d.id}: ${d.label}`).attr("fill", "#374151");
      secondDegree.forEach(id => episodesToShow.push(graphNodes.find(n => n.id === id)));

      displayEpisodeList(episodesToShow);
      displayNodeInfo(graphNodes.find(n => n.id === selectedNodeId));

      link.filter(d => {
        return (d.source.id === selectedNodeId && firstDegree.has(d.target.id)) ||
          (d.target.id === selectedNodeId && firstDegree.has(d.source.id)) ||
          (firstDegree.has(d.source.id) && secondDegree.has(d.target.id)) ||
          (firstDegree.has(d.target.id) && secondDegree.has(d.source.id));
      })
        .classed("dimmed", false)
        .attr("opacity", 1);
    }
  }

  node.on("click", (event, d) => {
    searchMessage.textContent = `Episodio ${d.id}: ${d.label}`;
    neighbourhoodHighlight(d.id);
    searchInput.property("value", d.id);
    displayNodeInfo(d);
  });

  searchButton.on("click", () => {
    const searchMessage = document.getElementById('searchMessage');
    searchMessage.textContent = '';
    const epNumber = parseInt(searchInput.property("value"));

    if (isNaN(epNumber)) {
      searchMessage.className = 'error';
      searchMessage.textContent = `Número de episódio invalido`;
      return;
    }

    let targetNode = graphNodes.find(n => n.id === epNumber);
    let finalEpNumber = epNumber;

    if (!targetNode) {
      finalEpNumber = epNumber - 1;
      targetNode = graphNodes.find(n => n.id === finalEpNumber);
    }

    if (targetNode) {
      neighbourhoodHighlight(finalEpNumber);
      const scale = 1.5;
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-targetNode.x, -targetNode.y);
      svg.transition().duration(750).call(zoom.transform, transform);
    } else {
      searchMessage.className = 'error';
      searchMessage.textContent = `Episodio ${epNumber} não encontrado`;
    }
  });

  const tabButtons = d3.selectAll(".tab-button");
  tabButtons.on("click", function () {
    const tabId = d3.select(this).attr("data-tab");
    d3.selectAll(".tab-content").style("display", "none");
    d3.select("#" + tabId).style("display", "block");
    tabButtons.classed("active", false);
    d3.select(this).classed("active", true);
  });

  clearButton.on("click", () => {
    const searchMessage = document.getElementById('searchMessage');
    searchMessage.textContent = '';
    searchInput.property("value", "");
    displayEpisodeList([]);
    neighbourhoodHighlight(null);
    displayNodeInfo(null);
  });

  function displayEpisodeList(episodes) {
    if (episodes.length === 0) {
      episodeListDiv.style("display", "none");
      return;
    }

    episodes.sort((a, b) => a.id - b.id);

    let tableHtml = "<table>";
    tableHtml += "<thead><tr><th>ID do Episódio</th><th>Título do Episódio</th></tr></thead>";
    tableHtml += "<tbody>";

    episodes.forEach(episode => {
      tableHtml += `<tr><td>${episode.id}</td><td>${episode.label}</td></tr>`;
    });

    tableHtml += "</tbody></table>";
    episodeListDiv.style("display", "block").html(tableHtml);
  }

  function displayNodeInfo(node) {
    if (!node || !node.metrics) {
      nodeInfoDiv.html("<p>Clique ou pesquise um nó no grafo para ver suas métricas.</p>");
      return;
    }

    const { metrics, id, label } = node;
    const content = `
        <h4>Métricas para o Episódio ${id}</h4>
        <p><strong>Título:</strong> ${label}</p>
        <ul>
            <li><strong>Grau (Total de conexões):</strong> ${metrics.degree}</li>
            <li><strong>Grau de Entrada (Citações Recebidas):</strong> ${metrics.inDegree}</li>
            <li><strong>Grau de Saída (Citações Feitas):</strong> ${metrics.outDegree}</li>
            <li><strong>Coeficiente de Agrupamento:</strong> ${metrics.clustering.toFixed(3)}</li>
        </ul>
        <small>O <strong>coeficiente de agrupamento</strong> mede o quão conectados os vizinhos deste nó estão entre si. Um valor de 1 significa que todos os vizinhos são conectados, formando um "clique". Um valor de 0 significa que nenhum vizinho se conecta.</small>
        <small>Ver mais em <a href="https://pt.wikipedia.org/wiki/Coeficiente_de_agrupamento">https://pt.wikipedia.org/wiki/Coeficiente_de_agrupamento</a></small>
    `;
    nodeInfoDiv.html(content);
  }

  calculateNetworkMetrics();
}

initGraph();