## Grafo do Naruhodo 🧠

Visualização interativa da rede de conexões entre os episódios do podcast [Naruhodo](https://www.b9.com.br/shows/naruhodo/). Cada nó é um episódio; cada aresta é uma citação de um episódio a outro.

![simplescreenrecorder-2025-07-13_16 45 21](https://github.com/user-attachments/assets/fd5a2637-7276-4d3e-a7ad-0c0432d1016c)

## Status :arrow_up:

Atualizado até o episódio 463

> Episódios em duas partes são mesclados — apenas o número da primeira parte é considerado.

## Funcionalidades 🖱️

- **Grafo interativo** com layout ForceAtlas2 e física ao vivo
- **Animação progressiva** — revela os nós episódio a episódio, com controle de velocidade
- **Cores por perfil** — gradiente entre laranja (muito citado) e azul (cita muito)
- **Tamanho por centralidade** — nós maiores têm mais conexões
- **Busca e destaque** — pesquise um episódio para ver seus vizinhos de 1º e 2º grau
- **Episódios Relacionados** — lista os episódios conectados ao nó selecionado
- **Ranking de episódios** — tabela filtrável e ordenável com métricas de rede:
  - Centralidade de grau (total, entrada e saída)
  - PageRank
  - Betweenness Centrality
- **Exportar CSV** — exporta a tabela com o filtro e ordenação ativos

## Como usar

Acesse **https://patricknatan.github.io/naruhodo_graph/**

Ou rode localmente:

```bash
npm install
npm run dev
```

## Tecnologia 🧑‍💻

- HTML, CSS e JS
- [Sigma.js](https://www.sigmajs.org/) para renderização do grafo (WebGL)
- [graphology](https://graphology.github.io/) para estrutura de dados e métricas do grafo
- [ForceAtlas2](https://graphology.github.io/standard-library/layout-forceatlas2) para layout com física ao vivo
- [Vite](https://vite.dev/) como bundler
- [PaperCSS](https://www.getpapercss.com/) para estilização
- [ESLint](https://eslint.org/) para linting

## Como contribuir? :shipit:

1. Faça o fork do projeto
2. Abra um pull request

Ou crie uma issue em https://github.com/PatrickNatan/naruhodo_graph/issues/new
