import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'msedge',headless:true});
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try {
 await p.route(/^https:\/\//,r=>r.abort());
 for(const width of [1440,360]){
  await p.setViewportSize({width,height:900});await p.goto('http://127.0.0.1:5175');await p.locator('.risk-score').waitFor();await p.getByRole('tab',{name:'Peta aktivitas',exact:true}).click();
  await p.locator('.terrain-view').waitFor();
  assert(await p.locator('.terrain-view').evaluate(e=>e.getBoundingClientRect().height>innerHeight*.65));
  await p.screenshot({path:`test-results/map-3d-${width}.png`});
  await p.getByRole('button',{name:'2D',exact:true}).click();
  assert(await p.locator('.map-canvas').evaluate(e=>e.getBoundingClientRect().width===innerWidth));
  if(width===360){
   assert.equal(await p.locator('.map-location').isVisible(),false);
   const location=p.getByRole('button',{name:'Wilayah & periode',exact:true});assert(await location.evaluate(e=>e.getBoundingClientRect().height>=44));await location.click();
   assert(await p.locator('.map-location').evaluate(e=>e.getBoundingClientRect().height<innerHeight*.5));
  }
  const search=p.getByRole('combobox',{name:'Cari provinsi'});await search.fill('Riau');await search.press('Enter');assert.equal(await p.getByLabel('Wilayah pemantauan').inputValue(),'Riau');
  await p.screenshot({path:`test-results/map-location-${width}.png`});
  if(width===360){await p.getByRole('button',{name:'Sensor & filter',exact:true}).click();assert.equal(await p.locator('.map-location').isVisible(),false);}
  await p.getByRole('button',{name:'VIIRS',exact:true}).click();await p.getByLabel('Hanya keyakinan tinggi',{exact:true}).check();
  await p.screenshot({path:`test-results/map-layers-${width}.png`});
  if(width===360)await p.getByRole('button',{name:'Tutup panel filter',exact:true}).click();
  await p.getByRole('button',{name:'Perbesar',exact:true}).click();
  assert(await p.locator('.map-source').isVisible());
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:`test-results/map-final-${width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('PASS: full-width 2D/3D canvas, floating panels, mobile drawers, search, sensors, filters, zoom, attribution, no overflow or runtime errors. External tiles blocked deliberately.');
}finally{await b.close();}
