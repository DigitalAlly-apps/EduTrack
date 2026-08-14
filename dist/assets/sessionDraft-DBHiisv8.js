import{c as r}from"./index-CzN3GZim.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=r("FilePenLine",[["path",{d:"m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2",key:"142zxg"}],["path",{d:"M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",key:"2t3380"}],["path",{d:"M8 18h1",key:"13wk12"}]]),n=t=>`edutrack_session_draft_${t}`;function l(t){try{const a=localStorage.getItem(n(t));if(!a)return null;const e=JSON.parse(a);return typeof(e==null?void 0:e.note)!="string"||typeof(e==null?void 0:e.reminder)!="string"||typeof(e==null?void 0:e.lastPage)!="string"?null:e}catch(a){return null}}function i(t,a){try{localStorage.setItem(n(t),JSON.stringify(a))}catch(e){}}function c(t){try{localStorage.removeItem(n(t))}catch(a){}}export{s as F,c,l,i as s};
