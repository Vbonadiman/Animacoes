# particulas-logo

> Uma peça da coleção [animacoes](../).

**Partículas que se reúnem e formam uma logo.** Transição de entrada para
aplicação web: as partículas se espalham, convergem e desenham a sua marca.

`particulas-logo.js` — **19 KB, sem nenhuma dependência**, script clássico,
sem bundler. Injeta o próprio CSS. A logo é um parâmetro: trocar de marca é
trocar o caminho de um PNG.

```
particulas-logo/
  particulas-logo.js    a biblioteca (só isso é obrigatório)
  exemplo.html          demonstração: troque a logo e veja na hora
  logos/exemplo.png     molde de exemplo (negativa, traço fino)
  README.md             este arquivo
```

Sem dependência, sem bundler, script clássico. Injeta o próprio CSS.

---

## Ver funcionando

```bash
cd animacoes/particulas-logo
python3 -m http.server 8000
```

Abra `http://localhost:8000/exemplo.html`.

> **Não abra o `exemplo.html` com duplo clique.** Veja *"O erro que todo mundo
> comete"* mais abaixo — em `file://` a logo não monta.

---

## Usar num projeto

```html
<script src="particulas-logo.js"></script>
<script>
  ParticulasLogo.tocar({ logo: 'img/minha-logo.png' })
    .then(() => mostrarPainel());
</script>
```

Só isso. O overlay cobre a tela, as partículas montam a logo, ele some sozinho e
a promessa resolve.

### Trocar a logo

Mude o caminho em `logo`. **Nada mais.** As cores saem do próprio arquivo
(`cores: 'auto'`, que é o padrão), então a marca de outra empresa monta com as
cores dela sem tocar em uma linha de código.

### Segurar até o backend responder

A logo fica **montada e parada** até a promessa
resolver, em vez de deixar a tela num "Conectando…".

```js
ParticulasLogo.tocar({
  logo: 'img/logo.png',
  aguardar: fetch('/api/conectar')      // a logo espera aqui
}).then(() => mostrarPainel());
```

### Versão embutida (não é tela cheia)

Para cabeçalho, capa de relatório ou tela de espera — monta dentro de um
elemento e **fica**:

```js
const a = ParticulasLogo.montarEm('#cabecalho', { logo: 'img/logo.png' });
a.refazer();                       // repete a montagem
a.trocarLogo('img/outra.png');     // troca em tempo de execução
a.destruir();                      // remove o canvas
```

Ela se redesenha sozinha quando o elemento muda de tamanho.

---

## O molde: como preparar a logo

O que faz a diferença entre montar bonito e montar torto:

| | |
|---|---|
| **Formato** | PNG com fundo **transparente**. JPG não serve — fundo opaco vira um bloco maciço de partículas. |
| **Recorte** | **Rente ao desenho**, sem margem sobrando. A margem transparente entra na conta do centro e joga a montagem para o lado. |
| **Cor** | A do fundo onde vai aparecer. O overlay é escuro por padrão, então use a **negativa** (clara) da marca — a positiva preta sumiria. |
| **Tamanho** | 700–1000 px de largura basta. Maior não melhora: as partículas são amostradas, não é a imagem que aparece. |
| **Detalhe fino** | Traço muito fino some na amostragem. Se a marca tem filete, baixe o `passo` para 2 ou 3. |

### Se a marca aparecer apagada (cinza em vez de sólida)

Não é opacidade — é **cobertura**, e ela vale `(tamanho médio da partícula / passo)²`.
Repare que **não depende do tamanho na tela**: encolher a logo não clareia nada.

| razão | cobertura | como lê |
|---|---|---|
| 1,5 / 4 (padrão) | ~14% | pontilhado leve — bom para marca de traço grosso |
| 2,05 / 3 | ~47% | cinza |
| 2,5 / 3 | ~69% | sólida, com grão visível |
| 2,5 / 2 | >100% | chapada, perde o efeito |

Marca grande e de traço fino (um símbolo quadrado, com moldura) precisa de razão
alta; um logotipo de palavra, com traço grosso, fica bom no padrão.

### Ao mudar `largura`, mexa em `passo` e tamanho junto

Encolher só a `largura` **afina os traços finos**: o traço passa a ter menos
pixels para a mesma amostragem, e uma moldura de 5 px vira uma de 2,5 px que o
passo 3 mal alcança. A cobertura não muda (ela é uma razão), mas o desenho fica
frágil.

Para reduzir mantendo o mesmo desenho, escale os três na mesma proporção:

| | grande | reduzido a 2/3 |
|---|---|---|
| `largura` | 0.45 | 0.30 |
| `passo` | 3 | 2 |
| `tamanhoMin` / `tamanhoMax` | 1.8 / 3.2 | 1.2 / 2.1 |

Cobertura antes e depois: ~68%. O resultado é a mesma marca, só menor.

O `logos/exemplo.png` é um bom exemplo do preparo: o arquivo original vinha **preto
sobre branco opaco e com margem**, que como máscara viraria um bloco maciço de
partículas fora do centro. Foi convertido para **negativa transparente recortada
rente** — ver "Preparando um molde a partir de um arquivo qualquer", abaixo.

⚠️ Marca com elemento solto ou palavra secundária: **tire o que não é o
símbolo** antes de usar como molde. Sobra transparente em volta entra na conta
do centro e descentra a montagem.

### Preparando um molde a partir de um arquivo qualquer

Marca preta sobre fundo branco, com margem, é o caso mais comum. Vira máscara
assim (precisa de Pillow):

```python
from PIL import Image
cinza = Image.open('marca-original.png').convert('L')

# Negativa: traço escuro vira BRANCO OPACO, fundo claro vira transparente.
# O limiar é essencial — fundo "quase branco" (253/254) viraria alfa 1..2, e o
# recorte automático levaria a folha inteira junto.
LIMIAR = 28
alfa = cinza.point(lambda v: 0 if (255 - v) < LIMIAR else 255 - v)

im = Image.new('RGB', cinza.size, (255, 255, 255))
im.putalpha(alfa)
im = im.crop(alfa.getbbox())      # recorte rente
im.thumbnail((760, 760), Image.LANCZOS)
im.save('logos/minha-marca.png', optimize=True)
```

Por que **negativa** (traço claro) e não a positiva: com `cores:'auto'` as
partículas saem claras, que é o que se quer sobre fundo escuro; e num tema claro
basta passar `cores` com um tom escuro — a forma continua sendo a marca. A
positiva preta só serviria para fundo claro, e sumiria no escuro.

### Sem logo nenhuma

Cai para texto, útil enquanto a arte não existe:

```js
ParticulasLogo.tocar({ texto: 'ACME' });
```

---

## Opções

Todas opcionais, com o padrão entre parênteses.

**O que montar**
| | |
|---|---|
| `logo` (`null`) | caminho, ou um `<img>` já na página |
| `texto` (`''`) | reserva quando não há logo, ou quando ela falha |
| `fonte` | fonte do texto de reserva; `{tam}` vira o tamanho calculado |

**Aparência**
| | |
|---|---|
| `cores` (`'auto'`) | `'auto'` tira do arquivo; ou uma cor CSS para pintar tudo de uma cor só |
| `fundo` (`'#161415'`) | fundo do overlay; `'transparent'` não pinta |
| `opacidade` (`0.95`) | opacidade das partículas |
| `tamanhoMin` / `tamanhoMax` (`0.7` / `2.3`) | lado do quadradinho, em px |
| `largura` (`0.62`) | fração da largura disponível que a logo ocupa |
| `larguraMax` (`780`) | teto em px, para não estourar em tela grande |

**Movimento**
| | |
|---|---|
| `montagem` (`1100`) | ms até as partículas chegarem |
| `espera` (`650`) | ms paradas, já montadas |
| `fade` (`450`) | ms de desaparecimento do overlay |
| `dispersao` (`'tela'`) | `'tela'`, `'centro'`, `'baixo'` ou `'anel'` |
| `aguardar` (`null`) | promessa: segura montada até resolver |

**Amostragem**
| | |
|---|---|
| `passo` (`4`) | 1 partícula a cada N px. **Menor = mais denso e mais pesado** |
| `limiarAlfa` (`128`) | pixel com alfa acima disso vira partícula |
| `maxParticulas` (`9000`) | teto; acima disso sorteia para baixo |

**Extras**
| | |
|---|---|
| `som` (`null`) | caminho de um áudio para tocar junto |
| `volume` (`0.9`) | |
| `respeitarReducaoMovimento` (`true`) | com "reduzir movimento" ligado no sistema, entra direto sem animar |
| `aoTerminar` (`null`) | além da promessa, se preferir callback |

Para mudar o padrão de um projeto inteiro de uma vez:

```js
ParticulasLogo.padroes.logo  = 'img/logo.png';
ParticulasLogo.padroes.fundo = '#0e1116';
ParticulasLogo.tocar();      // já usa os dois
```

---

## O erro que todo mundo comete

**Abrir o HTML com duplo clique (`file://`) e a logo não montar.**

Não é defeito da biblioteca. Ler os pixels de uma imagem (`getImageData`) é
proibido pelo navegador quando a página vem de `file://` — o canvas fica
"contaminado". A biblioteca detecta, **explica no console** e cai no texto de
reserva em vez de mostrar tela vazia.

Três saídas:

1. Sirva por HTTP: `python3 -m http.server 8000` (é o caso normal — num projeto
   real a página já vem de um servidor);
2. passe a logo como `data:` URI (o `exemplo.html` faz isso no botão de escolher
   arquivo, e por isso aquele botão funciona até em `file://`);
3. aceite o texto de reserva.

Se a logo estiver **em outro domínio**, esse servidor precisa mandar
`Access-Control-Allow-Origin` — senão os pixels também não podem ser lidos.

---

## Detalhes que valem saber

- **Cores vêm do arquivo.** Cada partícula guarda a cor do pixel que a originou,
  quantizada em degraus de 16, e o desenho faz **uma passada por cor**. Uma marca
  de cor chapada cai em duas ou três passadas — barato. O original tinha
  prata-e-vermelho no código; aqui isso saiu do código e virou dado.
- **Só o retângulo da logo é varrido**, não a janela inteira como no original.
  É o que segura o custo em tela grande.
- **Teto de partículas** (`maxParticulas`): acima dele sorteia para baixo, então
  monitor 4K não engasga.
- **Cada partícula tem um atraso próprio** (até 25% do tempo), o que dá o
  assentamento em vez de um "clique" seco com todas chegando juntas.
- **A troca de tela acontece com o overlay ainda opaco**, e só então o fade —
  ao contrário, a tela de trás aparece durante a transição.
- **`prefers-reduced-motion`** é respeitado por padrão: entra direto, sem animar.
- **Áudio pode ser bloqueado** pelo navegador se não houve gesto do usuário
  antes. É esperado, não quebra a animação.
