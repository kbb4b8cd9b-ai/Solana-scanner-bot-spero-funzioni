const cfg=window.APP_CONFIG||{};
const API=(cfg.API_BASE_URL||"").replace(/\/+$/,"");
const RPCS=cfg.RPC_ENDPOINTS||[];
const ALPHABET="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const TOKEN_PROGRAM="TokenkegQfeZyiNwAJYbbGKPFXCWuBvf9Ss623VQ5DA";
const $=id=>document.getElementById(id);
$("scanBtn").addEventListener("click",scan);
$("mint").addEventListener("keydown",e=>{if(e.key==="Enter")scan()});

function b58decode(s){let n=0n;for(const c of s){const i=ALPHABET.indexOf(c);if(i<0)throw Error("Base58 non valido");n=n*58n+BigInt(i)}let h=n.toString(16);if(h.length%2)h="0"+h;let a=[];for(let i=0;i<h.length;i+=2)a.push(parseInt(h.slice(i,i+2),16));let z=0;for(const c of s){if(c==="1")z++;else break}return new Uint8Array([...Array(z).fill(0),...a])}
function valid(s){try{return b58decode(s).length===32}catch{return false}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function status(t,c=""){$("status").className="status "+c;$("status").textContent=t}
async function rpc(method,params=[]){
 let last="";
 for(const url of RPCS){
  try{
   const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
   const text=await r.text();
   let j;try{j=JSON.parse(text)}catch{throw Error("RPC HTTP "+r.status)}
   if(j.error)throw Error(j.error.message||"RPC error");
   if(!r.ok)throw Error("RPC HTTP "+r.status);
   return j.result;
  }catch(e){last=e.message||"RPC error"}
 }
 throw Error("RPC non disponibile: "+last)
}
function bytes(data){return Uint8Array.from(atob(data),c=>c.charCodeAt(0))}
function u64(b,o){let n=0n;for(let i=0;i<8;i++)n+=BigInt(b[o+i])<<BigInt(8*i);return n}
function pubkey(b){let n=0n;for(const x of b)n=n*256n+BigInt(x);let out="";while(n){out=ALPHABET[Number(n%58n)]+out;n/=58n}while(out.length<44)out="1"+out;return out}
function parseMint(value){const b=bytes(value.data[0]);if(b.length<82)throw Error("Account mint non valida");return{mint_authority:b[0]?pubkey(b.slice(4,36)):null,supply:u64(b,36),decimals:b[44],freeze_authority:b[46]?pubkey(b.slice(50,82)):null}}
async function getMint(mint){const r=await rpc("getAccountInfo",[mint,{encoding:"base64",commitment:"confirmed"}]);if(!r||!r.value)throw Error("Mint non trovato sulla Solana mainnet.");return parseMint(r.value)}
async function getSupply(mint){return await rpc("getTokenSupply",[mint,{commitment:"confirmed"}])}
async function getLargest(mint){return await rpc("getTokenLargestAccounts",[mint,{commitment:"confirmed"}])}
function nfmt(n){return Number(n).toLocaleString("it-IT",{maximumFractionDigits:6})}
function pct(x){return Number(x||0)}
async function scan(){
 const mint=$("mint").value.trim();$("result").classList.add("hidden");
 if(!valid(mint)){status("Mint address non valido: deve essere una public key Solana base58 di 32 byte.","danger");return}
 $("scanBtn").disabled=true;status("Connessione alla Solana mainnet…");
 try{
  if(API){
   const r=await fetch(API+"/api/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mint})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.detail||"Errore backend");render(j);status("Analisi completata.","ok");return
  }
  const [mi,su,la]=await Promise.all([getMint(mint),getSupply(mint),getLargest(mint)]);
  const accounts=la?.value||[];
  const total=Number(su?.value?.amount||mi.supply.toString());
  const top=accounts.map(x=>({address:x.address,amount:Number(x.amount||0),percentage:total?pct(x.amount)*100/total:0}));
  const top1=top[0]?.percentage||0,top5=top.slice(0,5).reduce((s,x)=>s+x.percentage,0),top10=top.slice(0,10).reduce((s,x)=>s+x.percentage,0);
  let score=0,reasons=[];
  if(mi.mint_authority){score+=15;reasons.push("Mint authority ancora attiva (+15).")}
  if(mi.freeze_authority){score+=15;reasons.push("Freeze authority ancora attiva (+15).")}
  if(top10>=80){score+=25;reasons.push(`I primi 10 holder detengono circa ${top10.toFixed(2)}% (+25).`)}
  else if(top10>=60){score+=18;reasons.push(`I primi 10 holder detengono circa ${top10.toFixed(2)}% (+18).`)}
  else if(top10>=40){score+=10;reasons.push(`I primi 10 holder detengono circa ${top10.toFixed(2)}% (+10).`)}
  if(top1>=30){score+=10;reasons.push(`Il primo holder detiene circa ${top1.toFixed(2)}% (+10).`)}
  else if(top1>=15){score+=5;reasons.push(`Il primo holder detiene circa ${top1.toFixed(2)}% (+5).`)}
  if(!reasons.length)reasons=["Nessun indicatore incluso nel punteggio ha superato le soglie."];
  render({risk_score:score,risk_level:score>=75?"HIGH":score>=45?"MEDIUM":"LOW",authorities:{mint_authority:mi.mint_authority,freeze_authority:mi.freeze_authority},token:{supply_raw:su?.value?.amount||mi.supply.toString(),decimals:su?.value?.decimals??mi.decimals,supply_display:su?.value?.uiAmountString||nfmt(Number(mi.supply)/10**mi.decimals)},holders:{count:top.length,top1_pct:top1,top5_pct:top5,top10_pct:top10,top10:top.slice(0,10)},reasons,modules:{liquidity:"NON INCLUSA NELLO SCORE",wash_trading:"NON INCLUSO NELLO SCORE",source:"Solana RPC"}});
  status("Analisi completata.","ok")
 }catch(e){status("Errore: "+e.message,"danger")}finally{$("scanBtn").disabled=false}
}
function render(d){
 $("result").classList.remove("hidden");const score=Number(d.risk_score||0),level=d.risk_level||"LOW";
 $("score").textContent=score;$("level").textContent=level;$("level").className=level==="HIGH"?"high":level==="MEDIUM"?"medium":"low";
 const a=d.authorities||{};$("authority").innerHTML=`<div class="kv"><span>Mint authority</span><span class="${a.mint_authority?"danger":"ok"}">${a.mint_authority?"ATTIVA":"REVOCATA"}</span></div><div class="kv"><span>Freeze authority</span><span class="${a.freeze_authority?"danger":"ok"}">${a.freeze_authority?"ATTIVA":"REVOCATA"}</span></div>`;
 const t=d.token||{};$("tokenInfo").innerHTML=`<div class="kv"><span>Decimals</span><span>${esc(t.decimals??"—")}</span></div><div class="kv"><span>Supply</span><span>${esc(t.supply_display??t.supply_raw??"—")}</span></div>`;
 $("reasons").innerHTML=(d.reasons||[]).map(x=>`<li>${esc(x)}</li>`).join("");
 const h=d.holders||{};$("holders").innerHTML=`<div class="kv"><span>Top 1</span><span>${Number(h.top1_pct||0).toFixed(2)}%</span></div><div class="kv"><span>Top 5</span><span>${Number(h.top5_pct||0).toFixed(2)}%</span></div><div class="kv"><span>Top 10</span><span>${Number(h.top10_pct||0).toFixed(2)}%</span></div>`;
 const m=d.modules||{};$("modules").innerHTML=`<div class="kv"><span>Liquidity/DEX</span><span>${esc(m.liquidity||"—")}</span></div><div class="kv"><span>Wash trading</span><span>${esc(m.wash_trading||"—")}</span></div><div class="kv"><span>Fonte</span><span>${esc(m.source||"—")}</span></div>`;
}
