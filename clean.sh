#!/bin/bash
# Intentionally do not set -e.
if [ -f .docker-cids ]
then
    cat .docker-cids | xargs sudo docker rm -f
fi
rm -rf .meteor/local .docker-*
