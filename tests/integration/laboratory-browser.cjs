const {chromium}=require(process.env.LABORATORY_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'), fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.LABORATORY_CHROMIUM_PATH || '/opt/google/chrome/chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage(), errors=[], mutations=[];
 page.on('pageerror',e=>errors.push(e.message));
 const user={id:'10000000-0000-4000-8000-000000000001',email:'martin@example.com',is_active:true,laboratory_enabled:false,laboratory_global_enabled:true,created_at:'2026-10-20T12:00:00Z',last_activity_at:null,notes_count:12};
 let fail=false;
 await page.route('**/api/admin/**',async route=>{
  const req=route.request(), path=new URL(req.url()).pathname;
  if(req.method()==='PATCH'){
   mutations.push(req.postDataJSON());
   await new Promise(r=>setTimeout(r,300));
   if(fail){fail=false;return route.fulfill({status:503,json:{detail:'unavailable'}})}
   user.laboratory_enabled=req.postDataJSON().laboratory_enabled;
   return route.fulfill({json:user});
  }
  if(path==='/api/admin/users') return route.fulfill({json:{items:[user],total:1}});
  if(path===`/api/admin/users/${user.id}`) return route.fulfill({json:user});
  return route.fulfill({status:404,json:{detail:'not_found'}});
 });
 const origin=process.env.ADMIN_LABORATORY_ORIGIN || 'http://127.0.0.1:5176';
 await page.goto(`${origin}/#/users/${user.id}/show`);
 const control=page.getByLabel('Habilitar para esta cuenta');
 await control.waitFor();
 assert.equal(await control.isChecked(),false);
 await control.click();
 await page.getByText('Guardando acceso…').waitFor();
 assert.equal(await page.getByLabel('Guardando acceso…').isDisabled(),true);
 await page.waitForFunction(()=>document.querySelector('input[type="checkbox"]')?.checked===true);
 await control.waitFor();
 await page.getByText('Acceso a Laboratorio habilitado.',{exact:true}).waitFor();
 assert.equal(await control.isChecked(),true);
 assert.equal(user.laboratory_enabled,true);
 await page.reload(); await control.waitFor(); assert.equal(await control.isChecked(),true);
 fail=true; await control.click();
 await page.getByText('No se pudo confirmar el cambio.',{exact:false}).waitFor();
 assert.equal(await control.isChecked(),true);
 await control.click();
 await page.getByText('Acceso a Laboratorio deshabilitado.',{exact:true}).waitFor();
 assert.equal(await control.isChecked(),false);
 user.laboratory_global_enabled=false;
 await page.reload(); await control.waitFor();
 await page.getByText('Laboratorio está apagado globalmente.',{exact:false}).waitFor();
 const out=process.env.ADMIN_LABORATORY_SCREENSHOTS || '/tmp/mirror-admin-laboratory-qa';fs.mkdirSync(out,{recursive:true});
 await page.screenshot({path:out+'/account-desktop.png',fullPage:true});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  assert.equal(await control.isEnabled(),true);
  if(width===390)await page.screenshot({path:out+'/account-mobile.png',fullPage:true});
 }
 await page.goto(origin+'/#/users');
 await page.getByText('Usuarios',{exact:true}).first().waitFor();
 await page.getByText('martin@example.com',{exact:true}).waitFor();
 await page.screenshot({path:out+'/users-desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:844});
 await page.getByText('Laboratorio sin acceso',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(mutations.length,3); assert.deepEqual(mutations.map(m=>m.laboratory_enabled),[true,false,false]);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/result.json',JSON.stringify({mutations,errors,widths:[320,390,768,1440],savedAcrossReload:true,failedSaveKeepsActualState:true,globalOffExplained:true},null,2));
 console.log('Admin browser checks passed'); await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
