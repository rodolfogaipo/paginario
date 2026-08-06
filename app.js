/* ===========================================================
   PAGINÁRIO — funções compartilhadas (Realtime Database)
   Requer firebase-config.js carregado antes deste arquivo.
   =========================================================== */

const PAGINA_ATUAL = location.pathname.split('/').pop() || 'index.html';

/* ---------- proteção de rotas ---------- */
function exigirLogin(aoLogar){
  auth.onAuthStateChanged(user=>{
    if(!user) location.href = 'index.html';
    else aoLogar(user);
  });
}
function seJaLogadoRedirecionar(destino='inicio.html'){
  auth.onAuthStateChanged(user=>{ if(user) location.href = destino; });
}
function sair(){ auth.signOut().then(()=> location.href = 'index.html'); }

/* ---------- utilitários gerais ---------- */
function formatarNumero(n){ return (n||0).toLocaleString('pt-BR'); }

function iniciais(nome){
  if(!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0]||'') + (p.length>1?p[p.length-1][0]:'')).toUpperCase();
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function marcarAbaAtiva(){
  document.querySelectorAll('.item-nav-app').forEach(a=>{
    if(a.getAttribute('href') === PAGINA_ATUAL) a.classList.add('ativo');
  });
}

function hojeStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function mesAtualStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function diaAnteriorStr(diaStr){
  const d = new Date(diaStr+'T00:00:00');
  d.setDate(d.getDate()-1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function mesesAnteriores(mesStr, n){
  const [ano, mes] = mesStr.split('-').map(Number);
  const out = [];
  for(let i=1;i<=n;i++){
    const d = new Date(ano, mes-1-i, 1);
    out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
  }
  return out;
}
function nomeMesAtual(){
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return meses[new Date().getMonth()];
}

/* Redimensiona/comprime uma imagem para caber como base64 no banco */
function comprimirImagem(file, maxLargura=420, qualidade=0.72){
  return new Promise((resolve, reject)=>{
    if(!file){ resolve(null); return; }
    const leitor = new FileReader();
    leitor.onload = e =>{
      const img = new Image();
      img.onload = ()=>{
        const escala = Math.min(1, maxLargura / img.width);
        const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(file);
  });
}

/* ---------- cadastro / usuários ---------- */
async function verificarUsernameDisponivel(username){
  const lower = username.toLowerCase().replace(/^@/,'').trim();
  const snap = await db.ref('usernames/'+lower).once('value');
  return !snap.exists();
}

async function criarConta(nome, username, email, senha, fotoBase64, metaInicial){
  const usernameLower = username.toLowerCase().replace(/^@/,'').trim();
  if(!/^[a-z0-9_]{3,20}$/.test(usernameLower)){
    throw { code:'custom/username-invalido' };
  }
  const refUsername = db.ref('usernames/'+usernameLower);
  const existente = await refUsername.once('value');
  if(existente.exists()) throw { code:'custom/username-em-uso' };

  const cred = await auth.createUserWithEmailAndPassword(email, senha);
  const uid = cred.user.uid;
  try{
    const resultado = await refUsername.transaction(atual => atual===null ? uid : undefined);
    if(!resultado.committed || resultado.snapshot.val() !== uid){
      throw { code:'custom/username-em-uso' };
    }
    await db.ref('usuarios/'+uid).set({
      nome, username: usernameLower, email,
      fotoBase64: fotoBase64 || null,
      totalPaginas: 0,
      livrosConcluidos: 0,
      metaMensal: metaInicial,
      metaManual: false,
      mesReferenciaPaginas: mesAtualStr(),
      paginasMesAtual: 0,
      sequenciaAtual: 0,
      ultimoCheckinData: null,
      criadoEm: firebase.database.ServerValue.TIMESTAMP
    });
  } catch(err){
    await cred.user.delete().catch(()=>{});
    throw err;
  }
  return uid;
}

function buscarPerfilUsuario(uid){
  return db.ref('usuarios/'+uid).once('value').then(s=> s.exists() ? {id:uid, ...s.val()} : null);
}

async function buscarUsuarioPorUsername(username){
  const lower = username.toLowerCase().replace(/^@/,'').trim();
  const snap = await db.ref('usernames/'+lower).once('value');
  if(!snap.exists()) return null;
  return buscarPerfilUsuario(snap.val());
}

function atualizarFotoPerfil(uid, fotoBase64){
  return db.ref('usuarios/'+uid+'/fotoBase64').set(fotoBase64);
}

function atualizarNomePerfil(uid, novoNome){
  return db.ref('usuarios/'+uid+'/nome').set(novoNome);
}

function definirMetaManual(uid, novaMeta){
  return db.ref('usuarios/'+uid).update({ metaMensal: parseInt(novaMeta,10)||0, metaManual:true });
}

/* Verifica virada de mês: reseta páginas do mês e sugere nova meta (se não for manual) */
async function verificarViradaDeMes(uid, usuario){
  const mesAtual = mesAtualStr();
  if(usuario.mesReferenciaPaginas === mesAtual) return usuario;

  let novaMeta = usuario.metaMensal;
  if(!usuario.metaManual){
    const meses = mesesAnteriores(mesAtual, 3);
    const snaps = await Promise.all(meses.map(m=> db.ref('historicoMeses/'+uid+'_'+m).once('value')));
    const validos = snaps.filter(s=>s.exists()).map(s=> s.val().paginas||0);
    if(validos.length){
      const media = validos.reduce((a,b)=>a+b,0) / validos.length;
      novaMeta = Math.max(100, Math.round(media/50)*50);
    }
  }

  await db.ref('usuarios/'+uid).update({
    mesReferenciaPaginas: mesAtual, paginasMesAtual: 0, metaMensal: novaMeta
  });
  return { ...usuario, mesReferenciaPaginas: mesAtual, paginasMesAtual: 0, metaMensal: novaMeta };
}

/* ---------- ranking ---------- */
async function buscarRanking(){
  const snap = await db.ref('usuarios').once('value');
  const out = [];
  snap.forEach(child=>{ out.push({id:child.key, ...child.val()}); });
  out.sort((a,b)=> (b.totalPaginas||0) - (a.totalPaginas||0));
  return out;
}

/* ---------- livros ---------- */
function comecarLivro(uid, dados){
  const ref = db.ref('livros').push();
  return ref.set({
    uid,
    titulo: dados.titulo, autor: dados.autor,
    editora: dados.editora||'', edicao: dados.edicao||'',
    paginasTotal: parseInt(dados.paginasTotal,10)||0,
    paginasLidas: 0,
    status: 'andamento',
    capaBase64: dados.capaBase64 || null,
    personagemPrincipal:'', resumo:'', citacaoPreferida:'',
    iniciadoEm: firebase.database.ServerValue.TIMESTAMP,
    concluidoEm: null
  }).then(()=> ref.key);
}

async function buscarLivrosDoUsuario(uid){
  const snap = await db.ref('livros').orderByChild('uid').equalTo(uid).once('value');
  const out = [];
  snap.forEach(child=>{ out.push({id:child.key, ...child.val()}); });
  return out;
}
function buscarLivrosAndamento(uid){
  return buscarLivrosDoUsuario(uid).then(l=> l.filter(x=>x.status==='andamento'));
}
function buscarLivrosConcluidos(uid){
  return buscarLivrosDoUsuario(uid).then(l=> l.filter(x=>x.status==='concluido')
    .sort((a,b)=> (b.concluidoEm||0) - (a.concluidoEm||0)));
}

/* Registra o check-in diário: soma páginas no livro, no total, no mês, na sequência e nos desafios ativos */
async function adicionarCheckin(uid, nomeUsuario, livro, paginasHoje){
  paginasHoje = parseInt(paginasHoje,10) || 0;
  if(paginasHoje <= 0) throw new Error('Informe um número de páginas válido.');

  const usuarioSnap = await db.ref('usuarios/'+uid).once('value');
  const usuario = usuarioSnap.val();

  const hoje = hojeStr();
  let novaSequencia = usuario.sequenciaAtual || 0;
  if(usuario.ultimoCheckinData === hoje){ /* já registrou hoje, mantém */ }
  else if(usuario.ultimoCheckinData === diaAnteriorStr(hoje)) novaSequencia += 1;
  else novaSequencia = 1;

  const novasPaginasLidas = Math.min((livro.paginasLidas||0) + paginasHoje, livro.paginasTotal || (livro.paginasLidas||0)+paginasHoje);

  const mesAtual = mesAtualStr();
  const histSnap = await db.ref('historicoMeses/'+uid+'_'+mesAtual).once('value');
  const paginasHistoricoAtual = histSnap.exists() ? (histSnap.val().paginas||0) : 0;

  const idAtividade = db.ref('atividades').push().key;

  const atualizacoes = {};
  atualizacoes['livros/'+livro.id+'/paginasLidas'] = novasPaginasLidas;
  atualizacoes['usuarios/'+uid+'/totalPaginas'] = (usuario.totalPaginas||0) + paginasHoje;
  atualizacoes['usuarios/'+uid+'/paginasMesAtual'] = (usuario.paginasMesAtual||0) + paginasHoje;
  atualizacoes['usuarios/'+uid+'/sequenciaAtual'] = novaSequencia;
  atualizacoes['usuarios/'+uid+'/ultimoCheckinData'] = hoje;
  atualizacoes['atividades/'+idAtividade] = {
    uid, nomeUsuario, tipo:'checkin', tituloLivro: livro.titulo, paginas: paginasHoje,
    criadoEm: firebase.database.ServerValue.TIMESTAMP
  };
  atualizacoes['historicoMeses/'+uid+'_'+mesAtual] = { uid, mes: mesAtual, paginas: paginasHistoricoAtual + paginasHoje };

  await db.ref().update(atualizacoes);
  await atualizarProgressoDesafiosAtivos(uid, paginasHoje);

  return { novasPaginasLidas, novaSequencia };
}

async function atualizarProgressoDesafiosAtivos(uid, paginas){
  const idsSnap = await db.ref('desafiosPorUsuario/'+uid).once('value');
  if(!idsSnap.exists()) return;
  const ids = Object.keys(idsSnap.val());
  const agora = Date.now();
  const atualizacoes = {};
  for(const id of ids){
    const dSnap = await db.ref('desafios/'+id).once('value');
    const d = dSnap.val();
    if(!d) continue;
    const ativo = !d.dataFim || d.dataFim >= agora;
    if(ativo){
      const atual = (d.progresso && d.progresso[uid]) || 0;
      atualizacoes['desafios/'+id+'/progresso/'+uid] = atual + paginas;
    }
  }
  if(Object.keys(atualizacoes).length) await db.ref().update(atualizacoes);
}

/* Finaliza um livro: completa a ficha e fecha o total de páginas restante, se houver */
async function finalizarLivro(livro, uid, nomeUsuario, dados){
  const faltantes = Math.max(0, (livro.paginasTotal||0) - (livro.paginasLidas||0));
  const usuarioSnap = await db.ref('usuarios/'+uid).once('value');
  const usuario = usuarioSnap.val();
  const mesAtual = mesAtualStr();

  const idAtividade = db.ref('atividades').push().key;
  const atualizacoes = {};
  atualizacoes['livros/'+livro.id+'/status'] = 'concluido';
  atualizacoes['livros/'+livro.id+'/paginasLidas'] = livro.paginasTotal;
  atualizacoes['livros/'+livro.id+'/personagemPrincipal'] = dados.personagemPrincipal || '';
  atualizacoes['livros/'+livro.id+'/resumo'] = dados.resumo || '';
  atualizacoes['livros/'+livro.id+'/citacaoPreferida'] = dados.citacaoPreferida || '';
  atualizacoes['livros/'+livro.id+'/capaBase64'] = dados.capaBase64 || livro.capaBase64 || null;
  atualizacoes['livros/'+livro.id+'/concluidoEm'] = firebase.database.ServerValue.TIMESTAMP;
  atualizacoes['usuarios/'+uid+'/livrosConcluidos'] = (usuario.livrosConcluidos||0) + 1;

  if(faltantes > 0){
    atualizacoes['usuarios/'+uid+'/totalPaginas'] = (usuario.totalPaginas||0) + faltantes;
    atualizacoes['usuarios/'+uid+'/paginasMesAtual'] = (usuario.paginasMesAtual||0) + faltantes;
    const histSnap = await db.ref('historicoMeses/'+uid+'_'+mesAtual).once('value');
    const paginasHistoricoAtual = histSnap.exists() ? (histSnap.val().paginas||0) : 0;
    atualizacoes['historicoMeses/'+uid+'_'+mesAtual] = { uid, mes: mesAtual, paginas: paginasHistoricoAtual + faltantes };
  }
  atualizacoes['atividades/'+idAtividade] = {
    uid, nomeUsuario, tipo:'finalizado', tituloLivro: livro.titulo, paginas: livro.paginasTotal,
    criadoEm: firebase.database.ServerValue.TIMESTAMP
  };

  await db.ref().update(atualizacoes);
  if(faltantes > 0) await atualizarProgressoDesafiosAtivos(uid, faltantes);
}

function editarLivro(livroId, dados){
  const atualizacoes = {
    titulo: dados.titulo, autor: dados.autor,
    editora: dados.editora||'', edicao: dados.edicao||'',
    paginasTotal: parseInt(dados.paginasTotal,10)||0,
    personagemPrincipal: dados.personagemPrincipal||'',
    resumo: dados.resumo||'', citacaoPreferida: dados.citacaoPreferida||''
  };
  if(dados.capaBase64) atualizacoes.capaBase64 = dados.capaBase64;
  return db.ref('livros/'+livroId).update(atualizacoes);
}

async function removerLivro(livro, uid){
  const usuarioSnap = await db.ref('usuarios/'+uid).once('value');
  const usuario = usuarioSnap.val();
  const paginas = livro.paginasLidas || 0;
  const atualizacoes = {};
  atualizacoes['usuarios/'+uid+'/totalPaginas'] = Math.max(0, (usuario.totalPaginas||0) - paginas);
  atualizacoes['usuarios/'+uid+'/paginasMesAtual'] = Math.max(0, (usuario.paginasMesAtual||0) - paginas);
  if(livro.status === 'concluido'){
    atualizacoes['usuarios/'+uid+'/livrosConcluidos'] = Math.max(0, (usuario.livrosConcluidos||0) - 1);
  }
  atualizacoes['livros/'+livro.id] = null;
  await db.ref().update(atualizacoes);
}

/* ---------- clube do livro (desafios) ---------- */
async function buscarMeusDesafios(uid){
  const idsSnap = await db.ref('desafiosPorUsuario/'+uid).once('value');
  if(!idsSnap.exists()) return [];
  const ids = Object.keys(idsSnap.val());
  const desafios = await Promise.all(ids.map(id=> db.ref('desafios/'+id).once('value').then(s=> s.exists()?{id, ...s.val()}:null)));
  return desafios.filter(Boolean);
}
function buscarDesafio(id){
  return db.ref('desafios/'+id).once('value').then(s=> s.exists() ? {id, ...s.val()} : null);
}

async function criarDesafio(criadorUid, criadorInfo, nomeDesafio, convidados, duracaoMeses){
  const participantesUids = [criadorUid, ...convidados.map(c=>c.uid)];
  const participantes = {}; participantesUids.forEach(u=> participantes[u]=true);
  const participantesInfo = { [criadorUid]: criadorInfo };
  convidados.forEach(c=> participantesInfo[c.uid] = { nome:c.nome, username:c.username, fotoBase64:c.fotoBase64||null });
  const progresso = {}; participantesUids.forEach(u=> progresso[u]=0);

  let dataFim = null;
  if(duracaoMeses){
    const d = new Date();
    d.setMonth(d.getMonth()+duracaoMeses);
    dataFim = d.getTime();
  }

  const refDesafio = db.ref('desafios').push();
  const idDesafio = refDesafio.key;

  const atualizacoes = {};
  atualizacoes['desafios/'+idDesafio] = {
    nome: nomeDesafio, criadoPor: criadorUid,
    participantes, participantesInfo, progresso,
    duracaoMeses: duracaoMeses || null,
    dataInicio: firebase.database.ServerValue.TIMESTAMP,
    dataFim
  };
  participantesUids.forEach(u=>{
    atualizacoes['desafiosPorUsuario/'+u+'/'+idDesafio] = true;
    const idAtiv = db.ref('atividades').push().key;
    atualizacoes['atividades/'+idAtiv] = {
      uid:u, nomeUsuario: participantesInfo[u].nome, tipo:'entrouDesafio', nomeDesafio,
      criadoEm: firebase.database.ServerValue.TIMESTAMP
    };
  });
  await db.ref().update(atualizacoes);
  return idDesafio;
}

function diasRestantes(dataFim){
  if(!dataFim) return null;
  const ms = dataFim - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

/* ---------- atividade do clube (feed) ---------- */
async function buscarAtividadesRecentes(limite=10){
  const snap = await db.ref('atividades').orderByChild('criadoEm').limitToLast(limite).once('value');
  const out = [];
  snap.forEach(child=> out.push({id:child.key, ...child.val()}));
  return out.reverse();
}

function textoAtividade(a){
  const tempo = tempoRelativo(a.criadoEm);
  if(a.tipo === 'checkin') return `<b>${escapeHtml(a.nomeUsuario)}</b> leu ${formatarNumero(a.paginas)} pág. de "${escapeHtml(a.tituloLivro)}"<span class="tempo">${tempo}</span>`;
  if(a.tipo === 'finalizado') return `<b>${escapeHtml(a.nomeUsuario)}</b> terminou "${escapeHtml(a.tituloLivro)}"<span class="tempo">${tempo}</span>`;
  if(a.tipo === 'entrouDesafio') return `<b>${escapeHtml(a.nomeUsuario)}</b> entrou no desafio "${escapeHtml(a.nomeDesafio)}"<span class="tempo">${tempo}</span>`;
  return '';
}

function tempoRelativo(timestampMs){
  if(!timestampMs) return '';
  const diffMin = Math.round((Date.now() - timestampMs)/60000);
  if(diffMin < 1) return 'agora mesmo';
  if(diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin/60);
  if(diffH < 24) return `há ${diffH}h`;
  const diffD = Math.round(diffH/24);
  if(diffD === 1) return 'ontem';
  return `há ${diffD} dias`;
}

document.addEventListener('DOMContentLoaded', marcarAbaAtiva);
