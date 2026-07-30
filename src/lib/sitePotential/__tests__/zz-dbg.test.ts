import { it } from "vitest";
import { detectStreetFrontage } from "../streetFrontage";
const LAT0=-34.0489, LNG0=24.9187, ML=111320, MG=111320*Math.cos(LAT0*Math.PI/180);
const at=(e:number,n:number):[number,number]=>[LNG0+e/MG, LAT0+n/ML];
it("dbg",()=>{
  const rect=[at(0,0),at(30,0),at(30,20),at(0,20),at(0,0)];
  console.log("corner",JSON.stringify(detectStreetFrontage({ring:rect,roads:[
    {name:"First Road",layerId:"road-street",coordinates:[at(-8,-5),at(38,-5)]},
    {name:"Second Road",layerId:"road-street",coordinates:[at(-5,-8),at(-5,28)]}]}),null,1));
  const erf=[at(0,6),at(14,0),at(40,12),at(34,34),at(2,24),at(0,6)];
  console.log("erf",JSON.stringify(detectStreetFrontage({ring:erf,savedStreetName:"Padrone Crescent",roads:[{name:"Padrone Crescent",layerId:"road-street",coordinates:[at(-8,1),at(6,-5),at(16,-6)]}]}),null,1));
});
