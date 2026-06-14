#!/bin/bash
cd "$(dirname "$0")"
node serve.js &
sleep 1
open http://localhost:3000/modelling/
wait
