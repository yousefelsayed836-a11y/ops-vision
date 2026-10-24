#!/usr/bin/env bash
set -euo pipefail
cd /opt/opsvision
read -r -s -p "Paste Resend API key: " RESEND_API_KEY
printf '\n'
export RESEND_API_KEY
node --input-type=commonjs <<'NODE'
const fs=require('fs');const p='.env';let env=fs.readFileSync(p,'utf8');const settings={RESEND_API_KEY:process.env.RESEND_API_KEY,MAIL_FROM:'OpsVision <notifications@opsvision.org>'};if(!settings.RESEND_API_KEY.startsWith('re_'))throw Error('Invalid Resend API key');for(const [key,value] of Object.entries(settings)){const re=new RegExp('^'+key+'=.*$','m');const line=key+'='+JSON.stringify(value);env=re.test(env)?env.replace(re,line):env.trimEnd()+'\n'+line+'\n';}fs.writeFileSync(p,env,{mode:0o600});fs.chmodSync(p,0o600);console.log('Email settings saved.');
NODE
unset RESEND_API_KEY
cat > /etc/systemd/system/opsvision-notifications.service <<'UNIT'
[Unit]
Description=OpsVision email and push notifications
After=network-online.target opsvision.service
Wants=network-online.target
[Service]
Type=simple
WorkingDirectory=/opt/opsvision
Environment=NODE_ENV=production
EnvironmentFile=/opt/opsvision/.env
ExecStart=/usr/bin/node scripts/run.mjs tsx scripts/notification-worker.ts
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
mkdir -p /etc/systemd/system/opsvision.service.d
cat > /etc/systemd/system/opsvision.service.d/email-env.conf <<'ENV'
[Service]
EnvironmentFile=/opt/opsvision/.env
ENV
systemctl daemon-reload
systemctl enable --now opsvision-notifications
systemctl restart opsvision-notifications
systemctl restart opsvision
systemctl status opsvision-notifications --no-pager
