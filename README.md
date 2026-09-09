# Animacoes

Peças de animação e de interface que escrevi para os sistemas que mantenho, e
que servem sozinhas. Cada pasta é independente: copia, usa, pronto.

**O fio condutor é não ter dependência.** Gráfico é SVG escrito na mão, a
animação é CSS, o comportamento é JavaScript puro. Biblioteca entra quando paga
o próprio peso — e para estas coisas ela não paga.

| peça | o que é | tamanho |
|---|---|---|
| **[particulas-logo](particulas-logo/)** | partículas que se reúnem e formam uma logo; transição de entrada para uma aplicação | 19 KB, 0 dependências |

## Como usar qualquer uma delas

Cada pasta traz o arquivo, um `exemplo.html` que abre no navegador e um README
com os parâmetros. Nada de build, nada de `npm install`:

```bash
git clone https://github.com/Vbonadiman/Animacoes.git
cd Animacoes/particulas-logo
python3 -m http.server 8000     # e abra localhost:8000/exemplo.html
```

⚠️ Precisa de servidor local, mesmo sendo arquivo estático — em `file://` o
navegador bloqueia a leitura do PNG usado como molde, e a montagem não acontece.

## Licença

MIT. Use em projeto comercial se quiser; crédito é bem-vindo e não é exigido.
