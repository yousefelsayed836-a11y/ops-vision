import {describe,expect,it} from 'vitest';
import {inferServiceFromDuration} from '../../src/lib/wash-duration-inference';

describe('duration based wash service suggestion',()=>{
 const services=[{id:'external',name:'غسيل خارجي',minutes:20},{id:'full',name:'غسيل شامل',minutes:40}];
 it('suggests a distinctly matching service',()=>{
  expect(inferServiceFromDuration(21*60,services)).toMatchObject({service:{id:'external'},requiresReview:false});
 });
 it('asks for review when service durations overlap',()=>{
  expect(inferServiceFromDuration(30*60,services)).toMatchObject({service:null,requiresReview:true});
 });
 it('asks for review when footage is incomplete',()=>{
  expect(inferServiceFromDuration(60,services)).toMatchObject({service:null,requiresReview:true});
 });
});
