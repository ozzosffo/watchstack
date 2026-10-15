/**
 * Optional Cloudflare Worker API for WATCHSTACK.
 * Secrets: OPENAI_API_KEY, AI_ACCESS_CODE, TMDB_API_KEY (optional)
 * Vars: ALLOWED_ORIGIN=https://ozzosffo.github.io
 * NOTE: Access codes are for small/private groups; add per-user auth and server-side
 * rate limits/budgets before opening paid API generation to everyone.
 */
const json = (body, status = 200, origin = '') => new Response(JSON.stringify(body), {
  status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Watchstack-Code',
    'Vary': 'Origin',
  },
});
const types = new Set(['영화', '드라마', '애니', '기타']);
const format = {
  type: 'json_schema', name: 'watchstack_collection', strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['title','description','sections'],
    properties: {
      title: {type:'string'}, description:{type:'string'},
      sections: {type:'array', items: {type:'object', additionalProperties:false, required:['title','description','items'], properties: {
        title:{type:'string'},description:{type:'string'},
        items:{type:'array',items:{type:'object',additionalProperties:false,required:['title','type','year','wikiTitle'],properties:{
          title:{type:'string'},type:{type:'string',enum:[...types]},year:{type:['integer','null']},wikiTitle:{type:'string'}
        }}}
      }}}
    }
  }
};
async function generate(request, env, origin) {
  if (!env.OPENAI_API_KEY) return json({error:'AI API 비밀키가 등록되지 않았어요.'},503,origin);
  let input; try{input=await request.json()}catch{return json({error:'JSON 입력이 필요해요.'},400,origin)}
  const prompt=String(input?.prompt||'').trim().slice(0,1200);
  if(prompt.length<3)return json({error:'시청 리스트 요청을 좀 더 구체적으로 적어 주세요.'},400,origin);
  const system = `당신은 영화·드라마·애니 시청 리스트 큐레이터입니다. 한국어로 답하며 스포일러를 포함하지 않습니다.
사용자가 요청한 범위에 맞춰 정확한 공식 페이즈, 시즌, 작품 개봉 연도를 최대한 준수하고 중복을 피하십시오.
확인되지 않은 작품·에피소드·연도를 꾸며내지 마세요. 불확실한 연도는 null로 설정하십시오.
형식은 지정한 JSON 스키마를 지켜야 합니다. 각 작품은 한 줄 항목이며 wikiTitle은 확인 가능한 나무위키 문서 제목 또는 작품명입니다.
요청과 관련성이 높은 작품으로만 구성하세요. 너무 길지 않게, 최대 60작품, 최대 12그룹. 이미지 URL을 만들지 마세요.`;
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',input:[{role:'system',content:system},{role:'user',content:prompt}],text:{format},max_output_tokens:6000})});
  if(!res.ok)return json({error:`OpenAI 요청이 실패했어요 (${res.status}). 결제·한도·모델 접근을 확인해 주세요.`},502,origin);
  const result=await res.json();
  const output=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  if(!output)return json({error:'AI가 목록을 생성하지 못했어요. 다시 시도해 주세요.'},502,origin);
  try{const data=JSON.parse(output); return json(data,200,origin)}catch{return json({error:'AI 응답을 JSON으로 해석할 수 없어요.'},502,origin)}
}
async function poster(url, env, origin){
  if(!env.TMDB_API_KEY)return json({posterUrl:''},200,origin);
  const title=String(url.searchParams.get('title')||'').slice(0,150);
  const type=url.searchParams.get('type')||'영화';
  if(!title||!types.has(type))return json({posterUrl:''},200,origin);
  const isTV=type==='드라마'||type==='애니';
  const path=isTV?'tv':'movie';
  const year=Number(url.searchParams.get('year'))||0;
  const u=new URL(`https://api.themoviedb.org/3/search/${path}`);
  u.searchParams.set('query',title);u.searchParams.set('language','ko-KR');u.searchParams.set('include_adult','false');
  if(year>=1880&&year<=2100)u.searchParams.set(isTV?'first_air_date_year':'year',String(year));
  u.searchParams.set('api_key',env.TMDB_API_KEY);
  let r=await fetch(u,{headers:{'Accept':'application/json'}});
  if(!r.ok)return json({posterUrl:''},200,origin);
  let data=await r.json();
  if(!data.results?.length&&year){u.searchParams.delete(isTV?'first_air_date_year':'year');r=await fetch(u);if(r.ok)data=await r.json();}
  const item=data.results?.find(x=>x.poster_path)||null;
  const file=item?.poster_path||'';
  return json({posterUrl:/^\/[A-Za-z0-9_./-]+\.(jpg|png|webp)$/.test(file)?'https://image.tmdb.org/t/p/w342'+file:''},200,origin);
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://ozzosffo.github.io';
  if(origin!==allowed)return json({error:'허용되지 않은 출처입니다.'},403,allowed);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Watchstack-Code','Vary':'Origin'}});
  if(!env.AI_ACCESS_CODE||request.headers.get('X-Watchstack-Code')!==env.AI_ACCESS_CODE)return json({error:'AI 연결 코드가 올바르지 않아요.'},401,allowed);
  const url=new URL(request.url);
  try{
    if(url.pathname==='/generate'&&request.method==='POST')return await generate(request,env,allowed);
    if(url.pathname==='/poster'&&request.method==='GET')return await poster(url,env,allowed);
    return json({error:'찾을 수 없는 API 경로예요.'},404,allowed);
  }catch(e){return json({error:'서버에서 오류가 발생했어요.'},500,allowed)}
 }
};