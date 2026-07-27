#!/bin/bash
echo "善缘 Health Check $(date)"
curl -s -o /dev/null -w "首页: HTTP %{http_code}\n" http://47.242.80.65:3021/
curl -s -o /dev/null -w "API: HTTP %{http_code}\n" http://47.242.80.65:3021/api/health
ssh root@47.242.80.65 "pm2 list | head -10"
echo Done
