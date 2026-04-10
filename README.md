## Grafo do Naruhodo 🧠

A ideia desse repositorio é criar um FrontEnd web simples que consiga apresentar uma rede de conexões entre os episodios do podcast Naruhodo.
https://www.b9.com.br/shows/naruhodo/

![simplescreenrecorder-2025-07-13_16 45 21](https://github.com/user-attachments/assets/fd5a2637-7276-4d3e-a7ad-0c0432d1016c)

## Status :arrow_up:

Atualizado até o episodio 463

Observação:
Episodios duplos, por terem a mesma referencia, são fundidos em um único nó

## Como usar 🖱️

Acesse https://patricknatan.github.io/naruhodo_graph/

Ou clone o repositorio e rode localmente:

```bash
npm install
npm run dev
```

## Tecnologia 🧑‍💻

- HTML, CSS e JS
- [Sigma.js](https://www.sigmajs.org/) para renderização do grafo (WebGL)
- [graphology](https://graphology.github.io/) para estrutura de dados e métricas do grafo
- [ForceAtlas2](https://graphology.github.io/standard-library/layout-forceatlas2) para layout
- [Vite](https://vite.dev/) como bundler
- [PaperCSS](https://www.getpapercss.com/) para estilização
- [ESLint](https://eslint.org/) para linting

## Como contribuir? :shipit:

1 - Faça o fork do projeto

2 - Abra um pull request

Ou crie uma issue em https://github.com/PatrickNatan/naruhodo_graph/issues/new
