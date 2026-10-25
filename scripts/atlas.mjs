#!/usr/bin/env node
import {lintCLI,humanReport} from './lint.mjs';
const args=process.argv.slice(2),command=args.shift();
const {report,json}=lintCLI(command==='lint'?args:['--invalid-command',...args]);
if(json)process.stdout.write(JSON.stringify(report)+'\n');
else process.stdout.write(humanReport(report));
process.exitCode=report.exitCode;
