class Map {
 constructor(options){this.handlers={};this.canvas=document.createElement('canvas');this.canvas.width=240;this.canvas.height=160;options.container.append(this.canvas);const mode=new URLSearchParams(location.search).get('case');this.mode=mode;this.timer=setTimeout(()=>this.handlers[mode==='map-failure'?'error':'load']?.(),20);}
 on(name,fn){this.handlers[name]=fn;return this;}
 once(name,fn){this.handlers[name]=fn;return this;}
 addSource(){} addLayer(){} fitBounds(){}
 triggerRepaint(){if(this.mode==='map-timeout')return;this.paintTimer=setTimeout(()=>{this.canvas.getContext('2d').fillStyle='#008000';this.canvas.getContext('2d').fillRect(0,0,240,160);this.handlers.idle?.();},this.mode==='ready'?0:650);}
 remove(){clearTimeout(this.timer);clearTimeout(this.paintTimer);this.canvas.remove();}
}
class LngLatBounds{extend(){return this;}}
class Marker{setLngLat(){return this;}addTo(){return this;}}
export default {Map,LngLatBounds,Marker,accessToken:''};
