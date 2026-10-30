#!/bin/bash
# Google Cloud Shell で実行する：ランク戦の順位をサーバーで決める仕組みを入れる（何回実行しても大丈夫）
set -e
P=toto-monsters; R=asia-northeast1
gcloud config set project $P
echo "① 必要な機能をオンにします（少し時間がかかります）"
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com
NUM=$(gcloud projects describe $P --format='value(projectNumber)'); SA="$NUM-compute@developer.gserviceaccount.com"
echo "② サーバーのプログラムを置きます（2〜4分）"
gcloud functions deploy rankSettle --gen2 --runtime=nodejs20 --region=$R --source=. --entry-point=rankSettle --trigger-http --no-allow-unauthenticated --memory=512Mi --timeout=300s --service-account=$SA
URL=$(gcloud functions describe rankSettle --gen2 --region=$R --format='value(serviceConfig.uri)')
gcloud run services add-iam-policy-binding ranksettle --region=$R --member="serviceAccount:$SA" --role=roles/run.invoker >/dev/null
echo "③ 毎日ランク戦が終わったあとに動くようにします"
gcloud scheduler jobs delete rank-settle --location=$R --quiet >/dev/null 2>&1 || true
gcloud scheduler jobs create http rank-settle --location=$R --schedule="5 22 * * *" --time-zone="Asia/Tokyo" --uri="$URL" --http-method=GET --oidc-service-account-email=$SA --oidc-token-audience="$URL" --attempt-deadline=300s
gcloud scheduler jobs delete rank-settle2 --location=$R --quiet >/dev/null 2>&1 || true
gcloud scheduler jobs create http rank-settle2 --location=$R --schedule="15 22 * * *" --time-zone="Asia/Tokyo" --uri="$URL" --http-method=GET --oidc-service-account-email=$SA --oidc-token-audience="$URL" --attempt-deadline=300s
echo "④ ためしに1回動かします（前のランク戦の結果を作ります）"
gcloud scheduler jobs run rank-settle --location=$R
sleep 20
echo ""
echo "✅ できました！ この画面を閉じて大丈夫です"
