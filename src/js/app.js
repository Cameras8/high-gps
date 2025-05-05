document.addEventListener('DOMContentLoaded', function() {
    const locationButton = document.getElementById('getLocation');
    const stopLocationButton = document.getElementById('stopLocation');
    const copyButtonsContainer = document.getElementById('copyButtonsContainer');
    const copyDecimalBtn = document.getElementById('copyDecimalBtn');
    const copyDMSBtn = document.getElementById('copyDMSBtn');
    const copyLongBtn = document.getElementById('copyLongBtn');
    const copyLatBtn = document.getElementById('copyLatBtn');
    const resultDiv = document.getElementById('result');
    const copyMessage = document.getElementById('copyMessage');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    let latitude = null;
    let longitude = null;
    let latitudeDMS = null;
    let longitudeDMS = null;
    let watchId = null;
    let bestAccuracy = Infinity;
    let locationUpdateCount = 0;
    const MAX_LOCATION_UPDATES = 10; // 最多尝试10次获取位置
    const TARGET_ACCURACY = 20; // 目标精度20米
    
    // 检查浏览器是否支持地理位置API
    if (!navigator.geolocation) {
        resultDiv.innerHTML = '<p class="error">您的浏览器不支持地理位置功能</p>';
        locationButton.disabled = true;
        return;
    }
    
    // 十进制度转换为度分秒格式
    function decimalToDMS(decimal, isLatitude) {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesNotTruncated = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesNotTruncated);
        const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
        
        const direction = isLatitude 
            ? (decimal >= 0 ? "N" : "S") 
            : (decimal >= 0 ? "E" : "W");
        
        return `${degrees}° ${minutes}′ ${seconds}″ ${direction}`;
    }
    
    // 复制文本到剪贴板
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            copyMessage.classList.add('show');
            setTimeout(() => {
                copyMessage.classList.remove('show');
            }, 2000);
        } catch (err) {
            console.error('复制失败:', err);
            alert('复制失败，请手动复制坐标');
        }
        
        document.body.removeChild(textarea);
    }
    
    // 获取精度指示颜色
    function getAccuracyClass(accuracy) {
        if (accuracy <= TARGET_ACCURACY) {
            return 'accuracy-high';
        } else if (accuracy <= 50) {
            return 'accuracy-medium';
        } else {
            return 'accuracy-low';
        }
    }
    
    // 获取精度文本描述
    function getAccuracyDescription(accuracy) {
        if (accuracy <= TARGET_ACCURACY) {
            return '高精度';
        } else if (accuracy <= 50) {
            return '中等精度';
        } else {
            return '低精度';
        }
    }
    
    // 更新位置信息显示
    function updateLocationDisplay(position) {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        latitudeDMS = decimalToDMS(latitude, true);
        longitudeDMS = decimalToDMS(longitude, false);
        const accuracy = position.coords.accuracy;
        const accuracyClass = getAccuracyClass(accuracy);
        const accuracyDesc = getAccuracyDescription(accuracy);
        
        let html = `
            <p>获取成功！您当前的位置是：</p>
            <div class="format-title">十进制度格式</div>
            <div class="coordinate-display">
                <span class="coordinate-label">经度:</span> 
                <span class="coordinates">${longitude}</span>
            </div>
            <div class="coordinate-display">
                <span class="coordinate-label">纬度:</span> 
                <span class="coordinates">${latitude}</span>
            </div>
            
            <div class="format-title">度分秒格式</div>
            <div class="coordinate-display">
                <span class="coordinate-label">经度:</span> 
                <span class="coordinates">${longitudeDMS}</span>
            </div>
            <div class="coordinate-display">
                <span class="coordinate-label">纬度:</span> 
                <span class="coordinates">${latitudeDMS}</span>
            </div>
            
            <div class="format-title">其他信息</div>
            <div class="coordinate-display">
                <span class="coordinate-label">精确度:</span> 
                <span class="coordinates">
                    <span id="accuracyIndicator" class="${accuracyClass}"></span>
                    ${accuracy.toFixed(2)} 米 (${accuracyDesc})
                </span>
            </div>
        `;
        
        // 如果有高度信息
        if (position.coords.altitude) {
            html += `
                <div class="coordinate-display">
                    <span class="coordinate-label">海拔:</span> 
                    <span class="coordinates">${position.coords.altitude.toFixed(2)} 米</span>
                </div>
            `;
        }
        
        // 如果有前进方向
        if (position.coords.heading) {
            html += `
                <div class="coordinate-display">
                    <span class="coordinate-label">方向:</span> 
                    <span class="coordinates">${position.coords.heading.toFixed(2)}°</span>
                </div>
            `;
        }
        
        // 如果有速度信息
        if (position.coords.speed) {
            html += `
                <div class="coordinate-display">
                    <span class="coordinate-label">速度:</span> 
                    <span class="coordinates">${position.coords.speed.toFixed(2)} 米/秒</span>
                </div>
            `;
        }
        
        html += `<p>定位时间: ${new Date(position.timestamp).toLocaleString()}</p>`;
        
        // 添加各种地图链接
        html += `
            <div class="format-title">在地图中查看</div>
            <div class="map-links">
                <a href="https://map.baidu.com/?latlng=${latitude},${longitude}" class="map-link" target="_blank">百度地图</a>
                <a href="https://uri.amap.com/marker?position=${longitude},${latitude}" class="map-link" target="_blank">高德地图</a>
                <a href="https://www.google.com/maps?q=${latitude},${longitude}" class="map-link" target="_blank">Google地图</a>
            </div>
        `;
        
        // 添加精度提示
        if (accuracy > TARGET_ACCURACY) {
            html += `<p class="warning">当前位置精度为${accuracy.toFixed(2)}米，尚未达到目标精度(${TARGET_ACCURACY}米)。正在继续提高精度...</p>`;
        }
        
        resultDiv.innerHTML = html;
        copyButtonsContainer.style.display = 'grid';
    }
    
    // 连续获取位置以提高精度
    function watchPosition() {
        bestAccuracy = Infinity;
        locationUpdateCount = 0;
        
        // 显示进度条
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '正在提高定位精度...';
        
        // 显示停止按钮
        stopLocationButton.style.display = 'inline-block';
        locationButton.style.display = 'none';
        
        watchId = navigator.geolocation.watchPosition(
            // 成功回调
            function(position) {
                locationUpdateCount++;
                const currentAccuracy = position.coords.accuracy;
                
                // 更新进度条
                const progress = Math.min((locationUpdateCount / MAX_LOCATION_UPDATES) * 100, 100);
                progressBar.style.width = `${progress}%`;
                
                // 如果获取到更精确的位置
                if (currentAccuracy < bestAccuracy) {
                    bestAccuracy = currentAccuracy;
                    updateLocationDisplay(position);
                    progressText.textContent = `定位精度：${currentAccuracy.toFixed(2)}米，正在继续提高精度...`;
                }
                
                // 如果达到目标精度或者达到最大尝试次数
                if (currentAccuracy <= TARGET_ACCURACY || locationUpdateCount >= MAX_LOCATION_UPDATES) {
                    // 停止监视
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                    
                    // 隐藏进度条和停止按钮
                    progressContainer.style.display = 'none';
                    stopLocationButton.style.display = 'none';
                    locationButton.style.display = 'inline-block';
                    
                    if (currentAccuracy <= TARGET_ACCURACY) {
                        progressText.textContent = `已达到目标精度：${currentAccuracy.toFixed(2)}米`;
                    } else {
                        progressText.textContent = `已获取最佳精度：${bestAccuracy.toFixed(2)}米`;
                    }
                }
            },
            // 错误回调
            function(error) {
                let errorMessage = '';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '用户拒绝了位置请求';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '位置信息不可用';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '获取位置请求超时';
                        break;
                    case error.UNKNOWN_ERROR:
                        errorMessage = '发生未知错误';
                        break;
                }
                resultDiv.innerHTML = `<p class="error">错误: ${errorMessage}</p>`;
                copyButtonsContainer.style.display = 'none';
                
                // 隐藏进度条和停止按钮
                progressContainer.style.display = 'none';
                stopLocationButton.style.display = 'none';
                locationButton.style.display = 'inline-block';
                
                // 清除监视
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }
            },
            // 选项 - 使用最高精度设置
            {
                enableHighAccuracy: true, // 启用最高精度
                timeout: 30000,           // 增加超时时间到30秒
                maximumAge: 0             // 不使用缓存的位置
            }
        );
    }
    
    // 获取位置按钮点击事件
    locationButton.addEventListener('click', function() {
        // 显示加载中的状态
        resultDiv.innerHTML = '<p>正在获取精确位置信息 <span class="loading"></span></p>';
        copyButtonsContainer.style.display = 'none';
        
        // 开始位置监视
        watchPosition();
    });
    
    // 停止位置获取按钮点击事件
    stopLocationButton.addEventListener('click', function() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        
        // 隐藏进度条和停止按钮
        progressContainer.style.display = 'none';
        stopLocationButton.style.display = 'none';
        locationButton.style.display = 'inline-block';
        
        progressText.textContent = '定位已停止，已获取最佳精度：' + 
            (bestAccuracy !== Infinity ? bestAccuracy.toFixed(2) + '米' : '无法获取');
    });
    
    // 复制十进制经纬度按钮
    copyDecimalBtn.addEventListener('click', function() {
        if (longitude !== null && latitude !== null) {
            copyToClipboard(`${longitude}\t${latitude}`);
        }
    });
    
    // 复制度分秒经纬度按钮
    copyDMSBtn.addEventListener('click', function() {
        if (longitudeDMS !== null && latitudeDMS !== null) {
            copyToClipboard(`${longitudeDMS}\t${latitudeDMS}`);
        }
    });
    
    // 复制十进制经度按钮
    copyLongBtn.addEventListener('click', function() {
        if (longitude !== null) {
            copyToClipboard(longitude.toString());
        }
    });
    
    // 复制十进制纬度按钮
    copyLatBtn.addEventListener('click', function() {
        if (latitude !== null) {
            copyToClipboard(latitude.toString());
        }
    });
}); 