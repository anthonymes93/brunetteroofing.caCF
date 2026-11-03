const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const safe=(value)=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export async function onRequestPost({request,env}){
  if(!env.RESEND_API_KEY||!env.TURNSTILE_SECRET_KEY||!env.CONTACT_FROM_EMAIL||!env.CONTACT_TO_EMAIL)return json({error:'Contact form is not configured yet.'},503);
  if(Number(request.headers.get('content-length')||0)>12000)return json({error:'Request is too large.'},413);
  let payload;try{payload=await request.json();}catch{return json({error:'Invalid request.'},400)}
  const name=String(payload.name||'').trim(),email=String(payload.email||'').trim(),phone=String(payload.phone||'').trim(),message=String(payload.message||'').trim(),token=String(payload.turnstileToken||'');
  if(!name||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||phone.length>50||!message||message.length>5000||!token)return json({error:'Please complete the required fields and verification.'},400);
  let verification;
  try {
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||undefined})
    });
    if(!response.ok)return json({error:'Verification service is unavailable.'},502);
    verification=await response.json();
  }catch{return json({error:'Verification service is unavailable.'},502)}
  if(!verification.success)return json({error:'Verification failed. Please refresh and try again.'},403);
  const html='<h2>New Brunette Roofing contact inquiry</h2><p><strong>Name:</strong> '+safe(name)+'</p><p><strong>Email:</strong> '+safe(email)+'</p><p><strong>Phone:</strong> '+safe(phone||'Not provided')+'</p><p><strong>Message:</strong></p><p style="white-space:pre-wrap">'+safe(message)+'</p>';
  let sent;
  try {
    sent=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},
      body:JSON.stringify({from:env.CONTACT_FROM_EMAIL,to:[env.CONTACT_TO_EMAIL],reply_to:email,subject:'Brunette Roofing — New contact inquiry',html})
    });
  }catch{return json({error:'Unable to send your message right now.'},502)}
  if(!sent.ok){console.error('Resend contact form error',sent.status,(await sent.text()).slice(0,400));return json({error:'Unable to send your message right now.'},502)}
  return json({ok:true});
}
