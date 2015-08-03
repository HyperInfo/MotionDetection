// forked from akm2's "Slit Scan Camera" http://jsdo.it/akm2/gmjx
// forked from akm2's "Scanner Camera" http://jsdo.it/akm2/63bn

/**
 * requestAnimationFrame polyfill by Erik Möller
 * fixes from Paul Irish and Tino Zijdel
 *
 * @see http://paulirish.com/2011/requestanimationframe-for-smart-animating/
 * @see http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
 */
(function(e){var t=0;var n=["ms","moz","webkit","o"];var r="requestAnimationFrame";var i="cancelAnimationFrame";for(var s=0;s<n.length&&!e[r];++s){e[r]=e[n[s]+"RequestAnimationFrame"];e[i]=e[n[s]+"CancelAnimationFrame"]||e[n[s]+"CancelRequestAnimationFrame"]}if(!e.requestAnimationFrame)e[r]=function(n,r){var i=(new Date).getTime();var s=Math.max(0,16-(i-t));var o=e.setTimeout(function(){n(i+s)},s);t=i+s;return o};if(!e[i])e[i]=function(e){clearTimeout(e)}})(window);

// window.URL
window.URL = window.URL || window.webkitURL;

// navigator.getUserMedia
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;


// Config
var CANVAS_WIDTH = 465,
    CANVAS_HEIGHT = 348,
    MAX_SPEED = 15,
    MAX_SPEED_SQ = MAX_SPEED * MAX_SPEED;

// Vars

var video, canvas, context,
    pastImageData = null,
    destImageData,
    ball,
    threshold =50,
    showMap = true,
    gui;



var socket = io.connect('http://localhost:3000'); //ローカル

  //サーバから受け取るイベント
  socket.on("connect", function () {});  // 接続時
  socket.on("disconnect", function (client) {});  // 切断時
  socket.on("remoteVolume",function(data){
      //it should be call back function
      showVolume('RemoteVolume', data[0]); //graphics
  });

//send data to server
  function sendBroadcast(x, y) {
    var array = new Array(x,y);
    socket.emit("C_to_S_broadcast",array); // サーバへ送信
  }


//---------------

/**
 * Init
 */
function init() {
    if (!navigator.getUserMedia) {
        alert('getUserMedia() Not supported');
        return;
    }

    canvas = document.getElementById('c');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.style.top = ((document.getElementById('container').offsetHeight - CANVAS_HEIGHT) / 2 | 0) + 'px';
    context = canvas.getContext('2d');
    context.fillStyle = 'hotpink';

    destImageData = context.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);

    video = document.createElement('video');
    video.autoplay = true;

    ball = new Ball(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 25);

    navigator.getUserMedia({ video: true }, function(stream) {
    
        video.addEventListener('canplaythrough', function(e) {
            setTimeout(update, 1000);

            gui = new dat.GUI();
            gui.width = 250;
            gui.add(window, 'threshold', 0, 255).step(1).name('Threshold');
            gui.add(window, 'toggleDisplay').name('Toggle display');
            gui.close();

        }, false);

        video.src =  window.URL.createObjectURL(stream);
    }, function(e) {
        alert('Error: ' + (e.code === e.PERMISSION_DENIED ? 'Permission denied' : 'Unknown'));
    });
}

/**
 * マップ表示を切替
 */
function toggleDisplay(e) {
    showMap = !showMap;
}

/**
 * Update
 */
function update() {
    var W = CANVAS_WIDTH,
        H = CANVAS_HEIGHT,
        currImageData,
        ballRadius = ball.radius,
        forceX = 0,
        forceY = 0,
        vlenSq;

    context.save();
    context.translate(W, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, W, H);
    context.restore();

    currImageData = context.getImageData(0, 0, W, H);

    if (pastImageData) {
        var ballX = ball.x,
            ballY = ball.y,
            startX = Math.floor(ballX - ballRadius),
            startY = Math.floor(ballY - ballRadius),
            endX = Math.floor(ballX + ballRadius),
            endY = Math.floor(ballY + ballRadius),
            dx, dy, dist,
            forceX = 0,
            forceY = 0,
            fcount = 0,
            currPixels = currImageData.data,
            pastPixels = pastImageData.data,
            pa, ca, // 全チャンネルの平均出す場合
            rd, gd, bd, // 各チャンネルの最大差を出す場合
            diff,
            x, y, yi, i, i1, i2;

        // 表示用に出力用 ImageData に差分を書き込んでおく, 動作検出のメイン処理は下のループ
        if (showMap) {
            var destPixels = destImageData.data;

            for (y = 0, i = 0; y < H; y++) {
                yi = y * W;
                for (x = 0; x < W; x++, i += 4) {
                    i1 = i + 1;
                    i2 = i + 2;

                    pa = (pastPixels[i] + pastPixels[i1] + pastPixels[i2]) / 3;
                    ca = (currPixels[i] + currPixels[i1] + currPixels[i2]) / 3;

                    // rd = pastPixels[i] - currPixels[i];
                    // gd = pastPixels[i1] - currPixels[i1];
                    // bd = pastPixels[i2] - currPixels[i2];
                    
                    diff = pa - ca;
                    //diff = rd > gd ? rd > bd ? rd : bd > gd ? bd : gd : gd > bd ? gd : bd;
                    if (diff < 0) diff *= -1;
                    
                    destPixels[i] = destPixels[i + 1] = destPixels[i + 2] = diff > threshold ? 255 : 0;
                    destPixels[i + 3] = 64;//0;//255;
                }
            }
        }

        // 動作検出
        for (y = startY; y < endY; y++) {
            if (y < 0 || y >= endY) continue;
            yi = y * W;

            for (x = startX; x < endX; x++) {
                if (x < 0 || x >= endX) continue;

                i = (x + yi) << 2;
                i1 = i + 1;
                i2 = i + 2;
                
                // 前回と現在のピクセルの色の平均値を比較する
                pastAverage = (pastPixels[i] + pastPixels[i1] + pastPixels[i2]) / 3;
                currAverage = (currPixels[i] + currPixels[i1] + currPixels[i2]) / 3;
    
                // 差の絶対値が閾値を超えるならベクトルを加算
                diff = pastAverage - currAverage;
                if (diff < 0) diff *= -1;

                if (diff > threshold) {
                    forceX += (ballX - x) * 0.9;
                    forceY += (ballY - y) * 0.9;
                    fcount++;
                }
            }
        }

        // 平均をとってボールのベクトルの加算量とする
        if (fcount) {
            forceX /= fcount;
            forceY /= fcount;
        }
    }

    if (showMap) context.putImageData(destImageData, 0, 0);

    // 次で使用するために今回のピクセルを持ち越す
    pastImageData = currImageData;

    ball.vx += forceX;
    ball.vy += forceY;

    vlenSq = ball.vx * ball.vx + ball.vy * ball.vy;
    if (vlenSq > MAX_SPEED_SQ) {
        var vlen = Math.sqrt(vlenSq);
        ball.vx /= vlen / MAX_SPEED;
        ball.vy /= vlen / MAX_SPEED;
    };

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= 0.998;
    ball.vy *= 0.998;

    if (ball.x - ballRadius < 0) {
        ball.x = ballRadius;
        if (ball.vx < 0) ball.vx *= -1;
    } else if (ball.x + ballRadius > W) {
        ball.x = W - ball.radius;
        if (ball.vx > 0) ball.vx *= -1;
    }
    if (ball.y - ballRadius < 0) {
        ball.y = ballRadius;
        if (ball.vy < 0) ball.vy *= -1;
    } else if (ball.y + ballRadius > H) {
        ball.y = H - ballRadius;
        if (ball.vy > 0) ball.vy *= -1;
    }


    sendBroadcast(ball.x, ball.y);

    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2, false);
    context.fill();

    requestAnimationFrame(update);
}


/**
 * Ball
 */
function Ball(x, y, radius) {
    this.x = x || 0;
    this.y = y || 0;
    this.radius = radius || 0;
    this.vx = this.vy = 0;
}


// Init

window.addEventListener('load', init, false);
