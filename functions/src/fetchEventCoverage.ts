// functions/src/fetchEventCoverage.ts
import * as functions from "firebase-functions/v2";
import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import "./firebaseAdmin";

/* ---------- Types ---------- */
interface FetchEventCoverageData {
  event: string;
  description?: string;
  date?: string;
  keywords?: string[];
  mode?: "context" | "breaking";   // 👈 new toggle
}

interface SourceItem {
  title: string;
  link: string;
  sourceName: string;
  imageUrl?: string | null;
  pubDate?: string;
  descriptionText?: string;
  categories?: string[];
  score?: number;
  _why?: string[];
}

/* ---------- Feeds ---------- */
const FEEDS = [
  "https://www.thehindu.com/news/national/feeder/default.rss",
  "https://indianexpress.com/feed/",
  "https://www.hindustantimes.com/rss/topnews/rssfeed.xml",
  "https://www.livemint.com/rss/news",
  "https://feeds.feedburner.com/ndtvnews-top-stories",
  "https://www.business-standard.com/rss/latest.rss",
  "https://www.indiatoday.in/rss/home",
  "https://scroll.in/rss",
  "https://www.moneycontrol.com/rss/latestnews.xml",
  "https://theprint.in/feed/"
];

/* ---------- Utilities ---------- */
const tokenize = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);

const STOP = new Set([
  "the","a","an","and","or","of","to","in","on","for","with","by","at","from","as",
  "is","are","be","was","were","has","have","had","it","this","that","these","those",
  "india","indian","news","today","update","breaking","global","national","said","will"
]);
const tokensNoStop = (t: string) => tokenize(t).filter(w => !STOP.has(w));
const makeNgrams = (tokens: string[], n: number) => {
  const arr:string[]=[]; for(let i=0;i+n<=tokens.length;i++) arr.push(tokens.slice(i,i+n).join(" "));
  return arr;
};
const pickCore = (tokens:string[]) => {
  const uniq=Array.from(new Set(tokens)); uniq.sort((a,b)=>b.length-a.length);
  return uniq.slice(0,5);
};

/* ---------- Callable ---------- */
export const fetchEventCoverage = functions.https.onCall(
  { region:"asia-south1", timeoutSeconds:120, memory:"512MiB" },
  async (req: functions.https.CallableRequest<FetchEventCoverageData>) => {
    functions.logger.info("🟡 fetchEventCoverage invoked",{data:req.data});

    const {event,description="",date,keywords=[],mode="context"} = req.data||{};
    if(!event) throw new functions.https.HttpsError("invalid-argument","Event title required.");

    /* ----- Date parse ----- */
    let eventDate:Date|null=null;
    if(date) try{eventDate=new Date(date);}catch{eventDate=null;}

    /* ----- Parse feeds ----- */
    const parser=new Parser({
      customFields:{item:["media:thumbnail","enclosure","description","content:encoded","contentSnippet","categories"]}
    });

    const results=await Promise.allSettled(FEEDS.map(u=>parser.parseURL(u)));
    const items:SourceItem[]=[];
    for(const r of results){
      if(r.status!=="fulfilled")continue;
      const feed=r.value, feedTitle=feed.title||"Unknown";
      for(const i of feed.items){
        const title=i.title?.trim()||"", link=i.link?.trim()||"";
        if(!title||!link)continue;
        const raw=(i as any)["content:encoded"]||i.description||(i as any).contentSnippet||"";
        const desc=raw.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
        const img=i["media:thumbnail"]?.url||i.enclosure?.url||(i.description?.match(/<img[^>]+src=\"([^\">]+)/)?.[1]);
        items.push({
          title, link, sourceName:feedTitle,
          imageUrl:img||`${new URL(link).origin}/favicon.ico`,
          pubDate:i.pubDate||undefined,
          descriptionText:desc,
          categories:Array.isArray(i.categories)?i.categories:undefined
        });
      }
    }
    if(!items.length){functions.logger.warn("⚠️ No feed results");return{sources:[]};}

    /* ---------- Keyword prep ---------- */
    const eTok=tokensNoStop(event), dTok=tokensNoStop(description);
    const mTok=keywords.map(k=>k.toLowerCase()).filter(k=>!STOP.has(k));
    const allSearch=Array.from(new Set([...eTok,...dTok,...mTok]));
    const core=pickCore(allSearch);
    const bigrams=makeNgrams(eTok,2), trigrams=makeNgrams(eTok,3);
    const phrases=new Set([...bigrams,...trigrams]);

    /* ---------- Initial keyword-only scoring ---------- */
    const quickScore=(it:SourceItem)=>{
      const t=tokensNoStop(it.title), d=tokensNoStop(it.descriptionText||"");
      let s=0;
      const count=(arr:string[],kws:string[])=>kws.reduce((a,k)=>a+arr.filter(x=>x===k).length,0);
      s+=count(t,allSearch)*2+s+count(d,allSearch);
      if(core.some(k=>t.includes(k)))s+=3;
      return s;
    };
    const prelim=items.map(i=>({...i,score:quickScore(i)}))
      .sort((a,b)=>(b.score||0)-(a.score||0))
      .slice(0,100);

    /* ---------- Semantic pre-filter ---------- */
    const apiKey=process.env.OPENAI_API_KEY;
    let semSimScores:number[]=[];
    if(apiKey){
      try{
        const openai=new OpenAI({apiKey});
        const queryEmbed=(await openai.embeddings.create({
          model:"text-embedding-3-small",
          input:`${event} ${description}`
        })).data[0].embedding;
        const resp=await openai.embeddings.create({
          model:"text-embedding-3-small",
          input:prelim.map(i=>i.title)
        });
        const cosine=(a:number[],b:number[])=>{
          const dot=a.reduce((s,x,i)=>s+x*b[i],0);
          const nA=Math.sqrt(a.reduce((s,x)=>s+x*x,0));
          const nB=Math.sqrt(b.reduce((s,x)=>s+x*x,0));
          return dot/(nA*nB);
        };
        semSimScores=resp.data.map(d=>cosine(queryEmbed,d.embedding));
        functions.logger.info("✅ Semantic Layer Active",{count:semSimScores.length});
      }catch(e:any){functions.logger.warn("⚠️ Embedding step failed",e.message);}
    }else{
      functions.logger.warn("⚠️ No OpenAI key; skipping semantics");
    }

    /* ---------- Detailed scoring ---------- */
    const scored=prelim.map((it,idx)=>{
      it._why=[];
      const t=tokensNoStop(it.title);
      const d=tokensNoStop(it.descriptionText||"");
      const all=new Set([...t,...d]);
      let s=it.score||0;

      // must-have rule
      const coreInTitle=core.filter(k=>t.includes(k));
      const coreInText=core.filter(k=>all.has(k));
      if(coreInTitle.length<2&&coreInText.length<3){it._why?.push("fail:core");it.score=-1;return it;}
      it._why?.push(`coreTitle:${coreInTitle.join(",")}`);

      // phrase
      const titleStr=t.join(" ");
      for(const ph of phrases){if(titleStr.includes(ph)){s+=6;it._why.push(`phrase:${ph}`);}}

      // proximity
      const win=4;
      for(let i=0;i<t.length;i++){
        const winSet=new Set(t.slice(i,i+win));
        const hits=core.filter(k=>winSet.has(k)).length;
        if(hits>=2){s+=4;it._why.push(`prox@${i}:${hits}`);}
      }

      // recency
      if(eventDate&&it.pubDate){
        const pub=new Date(it.pubDate);
        const diff=Math.abs((pub.getTime()-eventDate.getTime())/(1000*60*60*24));
        if(diff<=1){s+=8;it._why.push("recency:+8");}
        else if(diff<=3){s+=5;it._why.push("recency:+5");}
        else if(diff<=7){s+=2;it._why.push("recency:+2");}
        else if(diff>30){s-=3;it._why.push("recency:-3");}
      }

      // publisher
      if(/thehindu|livemint|business-standard|hindustantimes|indianexpress/i.test(it.link)){
        s+=3;it._why.push("tier1:+3");
      }else if(/ndtv|moneycontrol|indiatoday|scroll|theprint/i.test(it.link)){
        s+=2;it._why.push("tier2:+2");
      }

      // top-news penalty or boost
      const isTop=/topnews|latest|breaking|live-updates/i.test(it.link);
      if(mode==="context"&&isTop){s-=4;it._why.push("penalty:topnews");}
      if(mode==="breaking"&&isTop){s+=4;it._why.push("boost:breaking");}

      // semantic add-on
      if(semSimScores[idx]!=null){const sim=semSimScores[idx]*50; s+=sim; it._why.push(`semantic:+${sim.toFixed(1)}`);}

      it.score=s;
      return it;
     }).filter(i => i.score !== -1);


    /* ---------- Rank ---------- */
    const sorted=scored.sort((a,b)=>(b.score||0)-(a.score||0));
    const top=sorted.slice(0,5);

    /* ---------- OG image fallback ---------- */
    for(const it of top){
      if(it.imageUrl&&!it.imageUrl.includes("favicon"))continue;
      try{
        const {data:html}=await axios.get(it.link,{timeout:8000,headers:{"User-Agent":"Mozilla/5.0"}});
        const $=cheerio.load(html);
        const og=$('meta[property="og:image"]').attr("content")||$('meta[name="twitter:image"]').attr("content")||$("img").first().attr("src");
        if(og)it.imageUrl=og;
      }catch{functions.logger.warn("⚠️ OG fetch failed",it.link);}
    }

    functions.logger.info("📊 Coverage summary",{
      mode,event,total:items.length,ranked:top.length,
      sample:top.map(t=>({title:t.title,score:t.score,why:t._why?.slice(0,8)}))
    });

    return {sources:top};
  }
);
