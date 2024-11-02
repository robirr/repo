import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create an S3 bucket to store the static website files
const siteBucket = new aws.s3.Bucket("siteBucket", {
    website: {
        indexDocument: "index.html",
        errorDocument: "error.html",
    },
});

// Upload the static website files to the S3 bucket
const indexHtml = new aws.s3.BucketObject("index.html", {
    bucket: siteBucket,
    source: new pulumi.asset.FileAsset("./www/index.html"),
    contentType: "text/html",
});

const errorHtml = new aws.s3.BucketObject("error.html", {
    bucket: siteBucket,
    source: new pulumi.asset.FileAsset("./www/error.html"),
    contentType: "text/html",
});

// Set the bucket policy to make the objects publicly readable
const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: siteBucket.bucket,
    policy: siteBucket.bucket.apply(publicReadPolicyForBucket),
});

function publicReadPolicyForBucket(bucketName: string): string {
    return JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [
                    `arn:aws:s3:::${bucketName}/*`,
                ],
            },
        ],
    });
}

// Create a CloudFront distribution pointing to the S3 bucket
const cdn = new aws.cloudfront.Distribution("cdn", {
    origins: [{
        originId: siteBucket.arn,
        domainName: siteBucket.websiteEndpoint,
        s3OriginConfig: {
            originAccessIdentity: "",
        },
    }],
    enabled: true,
    isIpv6Enabled: true,
    defaultRootObject: "index.html",
    defaultCacheBehavior: {
        targetOriginId: siteBucket.arn,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: {
            cookies: { forward: "none" },
            queryString: false,
        },
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    priceClass: "PriceClass_100",
    customErrorResponses: [{
        errorCode: 404,
        responseCode: 404,
        responsePagePath: "/error.html",
    }],
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
});

export const bucketName = siteBucket.bucket;
export const cloudFrontDomainName = cdn.domainName;
