import test from 'node:test';
import assert from 'node:assert/strict';
import {runConditions,isCorrectCondition} from '../lessons/digital-life-filter/game-core.js';
const c = (column,operator,value) => ({column,operator,value});
test('numeric boundary and two-condition execution', () => {
 assert.deepEqual(runConditions([c('가격','>=','1000')]).map(r=>r.ID),[0,2,3]);
 assert.deepEqual(runConditions([c('가격','>','1000')]).map(r=>r.ID),[2,3]);
 const conditions=[c('수량','>=','15'),c('과일','==','바나나')];
 assert.deepEqual(runConditions(conditions,'&').map(r=>r.ID),[1]);
 assert.equal(isCorrectCondition('b',conditions,'&'),true);
 assert.equal(isCorrectCondition('b',conditions,'|'),false);
 assert.equal(isCorrectCondition('c',[c('가격','>','1000')]),false);
});
test('invalid and incomplete values produce actionable errors', () => {
 assert.throws(()=>runConditions([c('가격','>=','abc')]),/숫자/);
 assert.throws(()=>runConditions([c('과일','>','사과')]),/과일/);
 assert.throws(()=>runConditions([c('가격','>=','')]),/입력/);
 assert.throws(()=>runConditions([c('가격','>=','1000'),c('수량','>=','15')]),/연결/);
});
