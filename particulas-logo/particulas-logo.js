/*!
 * particulas-logo.js — partículas que se reúnem e formam uma logo.
 *
 * Escrita como transição de login de um supervisório industrial e generalizada
 * para servir a qualquer projeto: a logo é um parâmetro, não está no código.
 *
 * Sem dependência, sem bundler, script clássico. Injeta o próprio CSS.
 *
 *   <script src="particulas-logo.js"></script>
 *   <script>
 *     ParticulasLogo.tocar({ logo: 'logos/exemplo.png' }).then(() => mostrarPainel());
 *   </script>
 *
 * TROCAR A LOGO: mude o caminho em `logo`. Nada mais. As cores saem do próprio
 * arquivo (cores: 'auto'), então uma marca de outra empresa monta com as cores
 * dela sem tocar em uma linha de código.
 *
 * O MOLDE IDEAL é um PNG com fundo TRANSPARENTE, recortado rente ao desenho
 * (sem margem sobrando) — a margem desloca a montagem para fora do centro.
 * Veja o LEIA-ME.md.
 *
 * ⚠️ file:// TAINTA O CANVAS. Ler os pixels de uma imagem (getImageData) é
 * proibido pelo navegador quando a página vem de file:// — a animação cai no
 * texto de reserva. Sirva por HTTP (`python3 -m http.server`) ou passe a logo
 * como data: URI. O erro é detectado e explicado no console, não fica mudo.
 */
(function (global) {
  'use strict';

  var CSS_ID = 'particulas-logo-css';
  var CSS = [
    '.plg-overlay{position:fixed;inset:0;z-index:25000;display:flex;',
    'align-items:center;justify-content:center;opacity:1;',
    'transition:opacity var(--plg-fade,450ms) ease;}',
    '.plg-overlay.plg-saindo{opacity:0;}',
    '.plg-overlay canvas,.plg-inline canvas{width:100%;height:100%;display:block;}',
    '.plg-inline{position:relative;}'
  ].join('');

  var PADRAO = {
    // --- o que montar ---
    logo: null,              // caminho, <img>, ou null para usar `texto`
    texto: '',               // reserva quando não há logo (ou ela falha)
    fonte: '700 {tam}px Oswald, "Segoe UI Semibold", "Segoe UI", sans-serif',

    // --- aparência ---
    cores: 'auto',           // 'auto' = tira do próprio arquivo; ou uma cor CSS
    fundo: '#161415',        // fundo do overlay ('transparent' para não pintar)
    opacidade: 0.95,         // opacidade das partículas
    tamanhoMin: 0.7,         // lado do quadradinho, em px CSS
    tamanhoMax: 2.3,
    largura: 0.62,           // fração da largura disponível ocupada pela logo
    larguraMax: 780,         // teto em px, para não estourar em tela grande

    // --- movimento ---
    montagem: 1100,          // ms até as partículas chegarem
    espera: 650,             // ms paradas, já montadas
    fade: 450,               // ms de desaparecimento do overlay
    dispersao: 'tela',       // 'tela' | 'centro' | 'baixo' | 'anel'
    aguardar: null,          // promessa: segura montada até resolver

    // --- amostragem ---
    passo: 4,                // 1 partícula a cada N px do molde (menor = mais denso)
    limiarAlfa: 128,         // pixel com alfa acima disso vira partícula
    maxParticulas: 9000,     // teto; acima disso sorteia para baixo

    // --- extras ---
    som: null,               // caminho de um áudio para tocar junto
    volume: 0.9,
    respeitarReducaoMovimento: true,
    aoTerminar: null
  };

  /* ------------------------------------------------------------------ */
  /* utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function injetarCss() {
    if (document.getElementById(CSS_ID)) return;
    var el = document.createElement('style');
    el.id = CSS_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function opcoes(dadas) {
    var o = {};
    for (var k in PADRAO) if (Object.prototype.hasOwnProperty.call(PADRAO, k)) o[k] = PADRAO[k];
    for (var j in dadas) if (Object.prototype.hasOwnProperty.call(dadas, j)) o[j] = dadas[j];
    return o;
  }

  function querReduzirMovimento() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Aceita caminho, <img> já no DOM, ou nada. Resolve com a imagem pronta
  // (decodificada) ou com null — nunca rejeita, para a animação sempre ter saída.
  function carregarImagem(logo) {
    return new Promise(function (resolve) {
      if (!logo) return resolve(null);
      if (typeof logo !== 'string') {
        // Já é um elemento: só espera terminar de carregar se ainda não terminou.
        if (logo.complete && logo.naturalWidth > 0) return resolve(logo);
        logo.addEventListener('load', function () { resolve(logo); }, { once: true });
        logo.addEventListener('error', function () { resolve(null); }, { once: true });
        return;
      }
      var img = new Image();
      // Só marca crossOrigin quando a logo vem MESMO de outra origem http(s):
      // aí ela precisa mandar Access-Control-Allow-Origin para os pixels serem
      // legíveis. Marcar sempre seria pior — em file:// o atributo reprova a
      // imagem antes de carregar, e o usuário receberia "não carreguei" em vez
      // da explicação certa sobre canvas contaminado.
      if (/^https?:\/\//i.test(logo) && logo.indexOf(location.origin) !== 0) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        console.warn(
          '[particulas-logo] não consegui carregar a logo: ' + logo +
          (/^https?:\/\//i.test(logo)
            ? '\n  Se ela está em outro domínio, o servidor precisa mandar Access-Control-Allow-Origin.'
            : '')
        );
        resolve(null);
      };
      img.src = logo;
    });
  }

  function tocarSom(o) {
    if (!o.som) return;
    try {
      var a = new Audio(o.som);
      a.volume = o.volume;
      // Navegador bloqueia áudio sem gesto do usuário; não é erro nosso.
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* sem áudio, segue a animação */ }
  }

  /* ------------------------------------------------------------------ */
  /* molde → alvos                                                       */
  /* ------------------------------------------------------------------ */

  // Desenha a logo (ou o texto) num canvas do TAMANHO DELA — não da tela — e
  // devolve os pixels. Varrer só o retângulo do desenho, em vez da janela
  // inteira como fazia o original, é o que segura o custo em tela grande.
  function desenharMolde(img, o, larguraDisp, alturaDisp) {
    var destW, destH, usouTexto = false;

    if (img) {
      var srcW = img.naturalWidth || img.width;
      var srcH = img.naturalHeight || img.height;
      destW = Math.min(larguraDisp * o.largura, o.larguraMax);
      destH = destW * (srcH / srcW);
      // Logo muito alta (quadrada, empilhada) não pode estourar a altura.
      var teto = alturaDisp * 0.7;
      if (destH > teto) { destH = teto; destW = destH * (srcW / srcH); }
    } else {
      usouTexto = true;
      destW = Math.min(larguraDisp * 0.9, o.larguraMax);
      destH = Math.min(larguraDisp * 0.16, 170);
    }

    destW = Math.max(1, Math.round(destW));
    destH = Math.max(1, Math.round(destH));

    var off = document.createElement('canvas');
    off.width = destW;
    off.height = destH;
    var octx = off.getContext('2d', { willReadFrequently: true });

    if (img) {
      octx.drawImage(img, 0, 0, destW, destH);
    } else {
      var texto = o.texto || '';
      var tam = Math.round(destH * 0.8);
      octx.fillStyle = '#ffffff';
      octx.font = o.fonte.replace('{tam}', tam);
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(texto, destW / 2, destH / 2);
    }

    var dados;
    try {
      dados = octx.getImageData(0, 0, destW, destH).data;
    } catch (e) {
      // SecurityError: canvas contaminado. Quase sempre é página em file://
      // com a logo vinda de arquivo. Dizer isso é melhor que animar em branco.
      console.warn(
        '[particulas-logo] não deu para ler os pixels da logo (canvas contaminado).\n' +
        '  Causa comum: a página foi aberta como file://. Sirva por HTTP —\n' +
        '  ex.: python3 -m http.server 8000 — ou passe a logo como data: URI.\n' +
        '  Caindo para o texto de reserva.', e
      );
      return null;
    }

    return { dados: dados, w: destW, h: destH, usouTexto: usouTexto };
  }

  // Percorre o molde e devolve as partículas, já agrupadas por cor: uma passada
  // de desenho por cor sai muito mais barato que trocar fillStyle por partícula.
  function extrairGrupos(molde, o, offsetX, offsetY, larguraDisp, alturaDisp) {
    var dados = molde.dados, w = molde.w, h = molde.h;
    var passo = Math.max(1, o.passo | 0);
    var corFixa = (o.cores && o.cores !== 'auto') ? String(o.cores) : null;
    var alvos = [];

    for (var y = 0; y < h; y += passo) {
      for (var x = 0; x < w; x += passo) {
        var i = (y * w + x) * 4;
        var a = dados[i + 3];
        if (a <= o.limiarAlfa) continue;
        alvos.push({
          x: x + offsetX,
          y: y + offsetY,
          r: dados[i], g: dados[i + 1], b: dados[i + 2], a: a
        });
      }
    }

    if (!alvos.length) return [];

    // Teto de partículas: sorteia para baixo em vez de engasgar a tela grande.
    if (alvos.length > o.maxParticulas) {
      var manter = o.maxParticulas / alvos.length;
      var filtrado = [];
      for (var k = 0; k < alvos.length; k++) if (Math.random() < manter) filtrado.push(alvos[k]);
      alvos = filtrado;
    }

    var grupos = {};
    for (var n = 0; n < alvos.length; n++) {
      var t = alvos[n];
      var chave, cor;
      if (corFixa) {
        chave = 'fixa';
        cor = corFixa;
      } else {
        // Quantiza em degraus de 16: uma marca de cor chapada cai em 2-3 grupos.
        var qr = t.r & 0xF0, qg = t.g & 0xF0, qb = t.b & 0xF0;
        chave = qr + '_' + qg + '_' + qb;
        cor = 'rgba(' + qr + ',' + qg + ',' + qb + ',' + (o.opacidade * (t.a / 255)).toFixed(3) + ')';
      }
      if (!grupos[chave]) grupos[chave] = { cor: cor, particulas: [] };
      grupos[chave].particulas.push(criarParticula(t, o, larguraDisp, alturaDisp));
    }

    var lista = [];
    for (var c in grupos) if (Object.prototype.hasOwnProperty.call(grupos, c)) lista.push(grupos[c]);
    return lista;
  }

  // De onde cada partícula parte.
  function criarParticula(alvo, o, w, h) {
    var x, y, ang, raio;
    switch (o.dispersao) {
      case 'centro':
        ang = Math.random() * Math.PI * 2;
        raio = Math.random() * Math.min(w, h) * 0.08;
        x = w / 2 + Math.cos(ang) * raio;
        y = h / 2 + Math.sin(ang) * raio;
        break;
      case 'baixo':
        x = Math.random() * w;
        y = h + Math.random() * h * 0.35;
        break;
      case 'anel':
        ang = Math.random() * Math.PI * 2;
        raio = Math.max(w, h) * (0.55 + Math.random() * 0.25);
        x = w / 2 + Math.cos(ang) * raio;
        y = h / 2 + Math.sin(ang) * raio;
        break;
      default: // 'tela'
        x = Math.random() * w;
        y = Math.random() * h;
    }
    return {
      x: x, y: y, tx: alvo.x, ty: alvo.y,
      tam: Math.random() * (o.tamanhoMax - o.tamanhoMin) + o.tamanhoMin,
      // Atraso pequeno e aleatório: as partículas não chegam todas no mesmo
      // instante, o que dá o assentamento em vez de um "clique" seco.
      atraso: Math.random() * 0.25
    };
  }

  /* ------------------------------------------------------------------ */
  /* motor                                                               */
  /* ------------------------------------------------------------------ */

  function Motor(canvas, o) {
    this.canvas = canvas;
    this.o = o;
    this.ctx = canvas.getContext('2d');
    this.grupos = [];
    this.raf = 0;
    this.w = 0;
    this.h = 0;
  }

  Motor.prototype.dimensionar = function (w, h) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // Prepara os alvos. Devolve false se não sobrou nada para desenhar.
  Motor.prototype.preparar = function (img) {
    var o = this.o;
    var molde = desenharMolde(img, o, this.w, this.h);
    if (!molde && o.texto) molde = desenharMolde(null, o, this.w, this.h);
    if (!molde) return false;

    var px = Math.round((this.w - molde.w) / 2);
    var py = Math.round((this.h - molde.h) / 2);
    this.grupos = extrairGrupos(molde, o, px, py, this.w, this.h);
    return this.grupos.length > 0;
  };

  Motor.prototype.pintar = function (avanco) {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (var i = 0; i < this.grupos.length; i++) {
      var g = this.grupos[i];
      ctx.fillStyle = g.cor;
      for (var j = 0; j < g.particulas.length; j++) {
        var p = g.particulas[j];
        // Cada partícula tem seu próprio pedaço da linha do tempo.
        var t = (avanco - p.atraso) / (1 - p.atraso);
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        ctx.fillRect(p.x + (p.tx - p.x) * e, p.y + (p.ty - p.y) * e, p.tam, p.tam);
      }
    }
  };

  // Anima da dispersão até o alvo. Resolve quando termina montagem + espera.
  Motor.prototype.rodar = function (comMovimento) {
    var self = this;
    var o = this.o;
    if (!comMovimento) {
      this.pintar(1);
      return new Promise(function (r) { setTimeout(r, o.espera); });
    }
    return new Promise(function (resolve) {
      var inicio = performance.now();
      (function quadro(agora) {
        var passado = agora - inicio;
        self.pintar(Math.min(passado / o.montagem, 1));
        if (passado < o.montagem + o.espera) {
          self.raf = requestAnimationFrame(quadro);
        } else {
          self.raf = 0;
          resolve();
        }
      })(inicio);
    });
  };

  Motor.prototype.parar = function () {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  };

  /* ------------------------------------------------------------------ */
  /* API                                                                 */
  /* ------------------------------------------------------------------ */

  // Overlay em tela cheia: monta a logo, segura, some. Devolve uma promessa
  // que resolve quando o overlay já saiu do caminho.
  //
  // `aguardar`: promessa opcional. A logo fica MONTADA E PARADA até ela
  // resolver — serve para não deixar a tela travada num "Conectando…" enquanto
  // o backend responde. Sem ela, o fade começa direto.
  function tocar(dadas) {
    var o = opcoes(dadas);
    injetarCss();

    var fim = function () {
      if (typeof o.aoTerminar === 'function') { try { o.aoTerminar(); } catch (e) { console.error(e); } }
    };

    if (o.respeitarReducaoMovimento && querReduzirMovimento()) {
      // Preferência do sistema por menos movimento: entra direto, sem animar.
      return Promise.resolve(o.aguardar).then(function () { fim(); });
    }

    var overlay = document.createElement('div');
    overlay.className = 'plg-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.setProperty('--plg-fade', o.fade + 'ms');
    if (o.fundo && o.fundo !== 'transparent') overlay.style.background = o.fundo;
    var canvas = document.createElement('canvas');
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    var motor = new Motor(canvas, o);
    motor.dimensionar(global.innerWidth, global.innerHeight);

    var limpar = function () {
      motor.parar();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    return carregarImagem(o.logo)
      .then(function (img) {
        tocarSom(o);
        if (!motor.preparar(img)) {
          console.warn('[particulas-logo] molde vazio — nada para animar.');
          limpar();
          return Promise.resolve(o.aguardar).then(fim);
        }
        return motor.rodar(true)
          .then(function () { return Promise.resolve(o.aguardar); })
          .then(function () {
            // Troca de tela AGORA, com o overlay ainda opaco, e só então o
            // fade. Ao contrário, a tela de trás aparece durante a transição.
            fim();
            overlay.classList.add('plg-saindo');
            return new Promise(function (r) { setTimeout(r, o.fade); });
          })
          .then(limpar);
      })
      .catch(function (e) {
        console.error('[particulas-logo] falhou:', e);
        limpar();
        return Promise.resolve(o.aguardar).then(fim);
      });
  }

  // Versão embutida: monta dentro de um elemento e FICA. Para splash de topo,
  // capa de relatório, tela de espera. Devolve um controle com refazer/destruir.
  function montarEm(alvo, dadas) {
    var el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    if (!el) throw new Error('[particulas-logo] elemento não encontrado: ' + alvo);
    var o = opcoes(dadas);
    injetarCss();

    el.classList.add('plg-inline');
    var canvas = el.querySelector('canvas.plg-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'plg-canvas';
      el.appendChild(canvas);
    }

    var motor = new Motor(canvas, o);
    var imagem = null;
    var vivo = true;
    var reflow;

    function medir() {
      var r = el.getBoundingClientRect();
      motor.dimensionar(Math.max(1, r.width), Math.max(1, r.height));
    }

    function desenhar(comMovimento) {
      if (!vivo) return Promise.resolve();
      medir();
      if (!motor.preparar(imagem)) return Promise.resolve();
      return motor.rodar(comMovimento !== false);
    }

    var pronto = carregarImagem(o.logo).then(function (img) {
      imagem = img;
      tocarSom(o);
      return desenhar(true);
    });

    // Redimensionou: remonta parado, sem repetir a animação a cada pixel.
    if (global.ResizeObserver) {
      reflow = new ResizeObserver(function () {
        clearTimeout(reflow._t);
        reflow._t = setTimeout(function () { motor.parar(); desenhar(false); }, 150);
      });
      reflow.observe(el);
    }

    return {
      pronto: pronto,
      refazer: function () { motor.parar(); return desenhar(true); },
      trocarLogo: function (novaLogo) {
        return carregarImagem(novaLogo).then(function (img) {
          imagem = img;
          motor.parar();
          return desenhar(true);
        });
      },
      destruir: function () {
        vivo = false;
        motor.parar();
        if (reflow) { clearTimeout(reflow._t); reflow.disconnect(); }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        el.classList.remove('plg-inline');
      }
    };
  }

  global.ParticulasLogo = {
    tocar: tocar,
    montarEm: montarEm,
    padroes: PADRAO,   // dá para editar de fora e valer para todas as chamadas
    versao: '1.0.0'
  };
})(window);
