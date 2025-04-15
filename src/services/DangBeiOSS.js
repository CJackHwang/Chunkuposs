import OSS from 'ali-oss';

/**
 * 从dangbei API获取STS临时凭证
 */
async function fetchSTSCredentials() {
  const response = await fetch('https://ai-api.dangbei.net/ai-search/fileApi/v1/sts');
  const responseJson = await response.json();
  
  if (!responseJson?.success || !responseJson?.data) {
    throw new Error('获取STS临时凭证失败');
  }
  
  const data = responseJson.data;
  console.log('STS凭证有效期至:', new Date(data.expiration).toLocaleString());
  
  return {
    accessKeyId: data.accessKeyId,
    accessKeySecret: data.accessKeySecret,
    securityToken: data.securityToken,
    region: data.regionId,
    bucket: data.bucket,
    endpoint: data.ossEndpoint,
    uploadPath: data.uploadPath,
    domainName: data.domainName
  };
}

/**
 * 上传文件到阿里云OSS
 * @param {File} file 要上传的文件
 * @param {Function} onProgress 进度回调函数
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadToOSS(file, onProgress) {
  try {
    // 获取凭证并创建客户端
    const credentials = await fetchSTSCredentials();
    const client = new OSS({
      endpoint: credentials.endpoint,
      region: credentials.region,
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.accessKeySecret,
      stsToken: credentials.securityToken,
      bucket: credentials.bucket,
      secure: true,
      timeout: 120000
    });
    
    // 构建路径并上传
    const fileName = file.name || `file_${Date.now()}`;
    const objectName = `${credentials.uploadPath}/${fileName}`;
    
    const result = await client.multipartUpload(objectName, file, {
      progress: (p) => onProgress?.(Math.floor(p * 100)),
      partSize: 1024 * 1024 * 2,
      timeout: 120000
    });
    
    // 生成文件URL
    const fileUrl = credentials.domainName 
      ? `${credentials.domainName}${objectName}`
      : result.res?.requestUrls?.[0]?.split('?')[0] || '';
    
    return {
      success: true,
      name: fileName,
      url: fileUrl,
      size: file.size,
      type: file.type
    };
  } catch (error) {
    console.error('上传失败:', error);
    return {
      success: false,
      name: file.name,
      error: error.message || '上传失败'
    };
  }
}

export default {
  uploadToOSS
}; 
