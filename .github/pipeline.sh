#!/bin/bash

cp README.md /srv/slate/
cd /srv/slate
bundler exec middleman build
cp -R build /github/workspace