const { google } = require('googleapis');
const bigquery = google.bigquery('v2');
const storage = google.storage('v1');
const storageTransfer = google.storagetransfer('v1')
const dataflow = google.dataflow("v1b3");
const AWS = require('aws-sdk');
const LineStream = require('byline').LineStream;

//////////////////////　実行準備 ////////////////////////////////////////////////////////////
// Lambda登録時に環境変数「GOOGLE_APPLICATION_CREDENTIALS」を指定する
// GOOGLE_APPLICATION_CREDENTIALS=./gcp_user.json
// GCPからAWSのクレデンシャルが必要な処理を実行する場合は、通常通り以下２つの環境変数を設定する
// - AWS_ACCESS_KEY_ID
// - AWS_SECRET_ACCESS_KEY

// ./gcp_user.json に、GCP側の利用サービスの権限を持ったサービスアカウントの
// JSONをダウンロードして保存すること(このファイルはGitにあげるとヤバいのでgitignoreしています。)

// Lambda実行時に、ハンドラには「index.gcpTest」を指定する
/////////////////////////////////////////////////////////////////////////////////////////////

async function runStorageTransfer() {

    // ※API経由でTransferServiceを使うには、
    // 　「APIs & Services」画面で「Storage Transfer API」を友好にする必要がある。
    //
    // ※APIを有効にし忘れて実行したときのエラーメッセージに書かれたURLが途中で切れている
    // 　("Storage Transfer API has not been used in project"という件のエラー)
    // 　以下が正しい
    // 　→ https://console.developers.google.com/apis/api/storagetransfer
    //
    // ※GCP側のStorageServiceを実行するサービスアカウントには、なんと！「EDITOR」権限が必要とのこと。
    // 　情報元→　https://cloud.google.com/storage-transfer/docs/create-client

    const client = await google.auth.getClient({
        // Scopes can be specified either as an array or as a single, space-delimited string.
        scopes: [
            'https://www.googleapis.com/auth/devstorage.full_control',
            'https://www.googleapis.com/auth/cloud-platform',
        ]
    });

    // obtain the current project Id
    const projectId = await google.auth.getDefaultProjectId();

    const params = {
        requestBody: {
            projectId: projectId,
            description: "transfer-test-01",
            status: "ENABLED",
            schedule: {
                scheduleStartDate: {
                    year: 2000,
                    month: 1,
                    day: 1,
                },
                scheduleEndDate: {
                    year: 2000,
                    month: 1,
                    day: 1,
                }
            },
            transferSpec: {
                awsS3DataSource: {
                    bucketName: "yterui-test-bucket-01",
                    awsAccessKey: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    }
                },
                gcsDataSink: {
                    bucketName: "yterui-transfer-test",
                },
                objectConditions: {
                    maxTimeElapsedSinceLastModification: 60*60*24*5 + "s",  // 5日以内に更新されたモノ
                    includePrefixes: [],
                    excludePrefixes: [],
                },
                transferOptions: {
                    overwriteObjectsAlreadyExistingInSink: false,   // シンクにあるオブジェクトをお常に上書きするか
                    deleteObjectsUniqueInSink: false,               // シンクにしかないオブジェクトを削除するか
                    deleteObjectsFromSourceAfterTransfer: false,    // シンクに転送したソースのオブジェクトを削除するか
                },
            },
        },
        auth: client
    };

    const res = await storageTransfer.transferJobs.create(params);
    console.log(res.data);
}

async function deleteBigQueryDataset() {

    // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
    // environment variables.
    const client = await google.auth.getClient({
        // Scopes can be specified either as an array or as a single, space-delimited string.
        scopes: [
            'https://www.googleapis.com/auth/bigquery',
            'https://www.googleapis.com/auth/devstorage.full_control'
        ]
    });

    // obtain the current project Id
    const projectId = await google.auth.getDefaultProjectId();

    const request = {
        projectId,
        datasetId: 'test_ds_xxx',

        // This is a "request-level" option
        auth: client
    };

    const res = await bigquery.datasets.delete(request);
    console.log(res.data);

    

    // const res = await compute.zones.list({ project, auth });
    // console.log(res.data);
}

// lambdaで動かす場合は、ハンドラに「runStorageTransfer」を指定する
exports.deleteBigQueryDataset = deleteBigQueryDataset;
exports.runStorageTransfer = runStorageTransfer;

// テスト・デバッグ時に有効化する
runStorageTransfer().catch(console.error);
