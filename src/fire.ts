// @ts-nocheck
// from: https://ghostinthecode.net/2016/08/17/fire.html

var ATTRIB_VERTEX=0;
var ATTRIB_TEXCOORD=1;

function getGLContext(c){
    var gl = null;
    var names = ['webgl', 'experimental-webgl','webkit-3d','moz-webgl'];

    for(var i in names ){
        try{
            gl = c.getContext(names[i]);
            if(gl)
                return gl;
        }catch(e){
            console.log('Error while trying to get WebGL context using ' + names[i], e);
        }
    }

    if(!gl)
        alert("Could not create a WebGL context, no demo for you :(");

    return gl;
}

function glerror(gl, where){
    var error = gl.getError();
    if(gl.NO_ERROR != error){
        alert("WebGL error:\n" + where + "\nError code: " + error);
        return true;
    }else{
        return false;
    }
}

function compile(gl, source, type){
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if(1 != gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        alert("Compile error: " + gl.getShaderInfoLog(shader));
        alert(source);
        return null;
    }

    return shader;
}

function link(gl, program){
    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        alert("Link error: " + gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

function shaderSource(name){
    return document.getElementById(name).text;
}

function loadProgram(gl, name){
    var vertexShaderSource = shaderSource(name + "-v");
    var fragmentShaderSource = shaderSource(name + "-f");

    return buildProgram(gl, vertexShaderSource, fragmentShaderSource);
}

function buildProgram(gl, vertSource, fragSource){
    var program = gl.createProgram();

    var vertShader = compile(gl, vertSource, gl.VERTEX_SHADER);
    if (!vertShader){
        return null;
    }


    var fragShader = compile(gl, fragSource, gl.FRAGMENT_SHADER);
    if (!fragShader){
        return null;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);

    // Bind attribute locations
    // this needs to be done prior to linking
    gl.bindAttribLocation(program, ATTRIB_VERTEX, "position");
    gl.bindAttribLocation(program, ATTRIB_TEXCOORD, "texcoord");

    if (!link(gl, program)){
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
        gl.deleteProgram(program);
        return null;
    }

    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    return program;

}

function loadShaders(gl, state){
    state.hotprogram      = loadProgram(gl, "hotparts");
    state.convolveprogram = loadProgram(gl, "convolve");
    state.blitprogram     = loadProgram(gl, "blit");
    state.paintprogram    = loadProgram(gl, "paint");

    return (state.hotprogram && state.convolveprogram && state.blitprogram &&
            state.paintprogram);
}

function emptyTexture(gl, texture, format, width, height){
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, null);
    if(glerror(gl, "Error from texImage2D")){
        return null;
    }
    return texture;
}

function loadTextures(gl, state){
    var width = 256;
    var height = 256;
    state.pingtex = emptyTexture(gl, gl.createTexture(), gl.RGBA, width, height);
    state.pongtex = emptyTexture(gl, gl.createTexture(), gl.RGBA, width, height);
    //state.hottex  = emptyTexture(gl, gl.createTexture(), gl.RGBA, width, height);
    state.texWidth = width;
    state.texHeight = height;

    state.palettetex = loadTexture(gl, "/assets/textures/spectrum.png", state);
    state.cooltex    = loadTexture(gl, "/assets/textures/coolmap.png", state);
    state.flickertex = loadTexture(gl, "/assets/textures/high-freq-noise-256.png", state);
    state.hottex     = loadTexture(gl, "/assets/textures/hotparts2.png", state);
    state.noisetex   = loadTexture(gl, "/assets/textures/smooth-noise.png", state);

    return (state.pingtex && state.pongtex && state.hottex &&
            state.palettetex && state.cooltex && state.flickertex &&
           state.noisetex);
}

function renderstateCreate(){
    var state = {
        uniforms : [],
        palettetex : {},
        cooltex : {},
        flickertex : {},
        noisetex : {},
        
        allTexturesLoaded : function () {
            return (this.palettetex.hasLoaded && this.cooltex.hasLoaded &&
                    this.flickertex.hasLoaded && this.hottex.hasLoaded &&
                    this.noisetex.hasLoaded);
        }
    };
    return state;
}

function renderstateInit(gl, state){
    state.uniforms['palettetex'] = gl.getUniformLocation(state.blitprogram, 'palette');
    state.uniforms['firetex']    = gl.getUniformLocation(state.blitprogram, 'tex');
    state.uniforms['hpel'] = gl.getUniformLocation(state.convolveprogram, 'hpel');
    state.uniforms['convolvetex'] = gl.getUniformLocation(state.convolveprogram, 'tex');
    state.uniforms['cooltex'] = gl.getUniformLocation(state.convolveprogram, 'cooltex');
    state.uniforms['upvec'] = gl.getUniformLocation(state.convolveprogram, 'up');
    state.uniforms['offset'] = gl.getUniformLocation(state.convolveprogram, 'offset');
    state.uniforms['noisetex'] = gl.getUniformLocation(state.convolveprogram, 'noisetex');
    state.uniforms['time'] = gl.getUniformLocation(state.convolveprogram, 'time');
    state.uniforms['flickertex'] = gl.getUniformLocation(state.hotprogram, 'flickertex');
    state.uniforms['hottex'] = gl.getUniformLocation(state.hotprogram, 'hottex');
    state.uniforms['randvec'] = gl.getUniformLocation(state.hotprogram, 'randvec');

    state.mainfbo = 0;
    state.renderbuffer = 0;

    gl.bindTexture(gl.TEXTURE_2D, state.palettetex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, state.cooltex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    gl.bindTexture(gl.TEXTURE_2D, state.flickertex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    gl.bindTexture(gl.TEXTURE_2D, state.noisetex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
    state.texfbo = gl.createFramebuffer();
    state.texrbo = gl.createRenderbuffer();

    gl.bindRenderbuffer(gl.RENDERBUFFER, state.texrbo);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, state.fbWidth, state.fbHeight);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    // renderToEmberTexture(gl, state);
    // gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT);
    // drawRing(gl, state);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // Render to main canvas again

    state.upx = 0.0;
    state.upy = 1.0 / state.texHeight;

    state.gravity = {x: 0.0, y: 0.0, z: 0.0};

    state.offsetx = 0.0;
    state.offsety = 0.0;

    state.startTime = Date.now();

    initVertexBuffers(gl, state);

    return state;
}

function renderToFireTexture(gl, state){
    // Update fire texture, read from pong, write to ping
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.texfbo);
    gl.bindRenderbuffer(gl.RENDERBUFFER, state.texrbo);
    gl.bindTexture(gl.TEXTURE_2D, state.pongtex);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.pingtex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, state.texrbo);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
        console.log("Could not init canvas fire texture, GL error: " + gl.checkFramebufferStatus(gl.FRAMEBUFFER) + "\n");
    gl.viewport(0, 0, state.texWidth, state.texHeight);

}

function renderToFrameBuffer(gl, state){
    // Render to main canvas object/tag
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, state.fbWidth, state.fbHeight);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}

function renderToEmberTexture(gl, state){
    // Render to the texture with "embers", i.e. where fire is burning.
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.texfbo);
    gl.bindRenderbuffer(gl.RENDERBUFFER, state.texrbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.hottex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, state.texrbo);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
        console.log("Could not init ember texture fbo, GL error: " + gl.checkFramebufferStatus(gl.FRAMEBUFFER) + "\n");
    gl.useProgram(state.paintprogram);
    gl.viewport(0, 0, state.texWidth, state.texHeight);

}

export function init(){
    var c = document.getElementById("c");
    var gl = getGLContext(c)
    if(!gl)
        return null;

    gl.viewport(0, 0, c.width, c.height);

    var renderstate = renderstateCreate();
    renderstate.fbWidth = c.width;
    renderstate.fbHeight = c.height;

    gl.getExtension("OES_standard_derivatives");

    if(!loadShaders(gl, renderstate) || !loadTextures(gl, renderstate)){
        return null;
    }

     return gl;
}

function initAfterTexturesLoaded(gl, renderstate){
    renderstate = renderstateInit(gl, renderstate);

    function animate (timestamp){
        drawFrame(gl, renderstate);
        window.requestAnimationFrame(animate);
    }

    var onClearButton = function(event){
        putOutFire(gl, renderstate);
    };

    var onStrokeEvent = function (start, end){
        onStroke(gl, renderstate, 0.01, start, end);
    };

    var canvas = document.getElementById('c');

    //drawFrame(gl, renderstate);
    window.requestAnimationFrame(animate);
}

function drawFrame(gl, state){
    // Add hottexture, modulated by flicker, to fire texture in ping
    renderToFireTexture(gl, state);
    gl.useProgram(state.hotprogram);
    var rx = Math.random();
    var ry = Math.random();
    gl.uniform2f(state.uniforms['randvec'], rx, ry);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.flickertex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.hottex);
    gl.uniform1i(state.uniforms['flickertex'], 0);
    gl.uniform1i(state.uniforms['hottex'], 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawFullScreenQuad(gl, state);
    gl.disable(gl.BLEND);

    // Blur and convect fire texture, read from ping, write to pong
    gl.useProgram(state.convolveprogram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.pingtex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.cooltex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.noisetex);
    gl.uniform1i(state.uniforms['convolvetex'], 0);
    gl.uniform1i(state.uniforms['cooltex'], 1);
    gl.uniform1i(state.uniforms['noisetex'], 2);
    gl.uniform2f(state.uniforms['upvec'], state.upx, state.upy);
    var time = 0.001 * (Date.now() - state.startTime);
    gl.uniform1f(state.uniforms['time'], time);
    var hpelx = 1.0 / state.texWidth;
    var hpely = 1.0 / state.texHeight;
    gl.uniform2f(state.uniforms['hpel'], hpelx, hpely);
    gl.uniform2f(state.uniforms['offset'], state.offsetx, state.offsety);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.pongtex, 0);
    
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
        console.log("Bad render to tex framebuffer object " +  gl.checkFramebufferStatus(gl.FRAMEBUFFER) + "\n");
    drawFullScreenQuad(gl, state);
    // var pixels = new Uint8Array(state.texWidth * state.texHeight * 4);
    // gl.readPixels(0, 0, state.texWidth, state.texHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    // Blit fire texture in pong to canvas element, converting grayscale to color
    renderToFrameBuffer(gl, state);
    gl.useProgram(state.blitprogram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.pongtex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.palettetex);
    gl.uniform1i(state.uniforms['firetex'], 0);
    gl.uniform1i(state.uniforms['palettetex'], 1);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawFullScreenQuad(gl, state);

    tick(state); // swap ping and pong
}

function drawRing(gl, renderstate){
    gl.enableVertexAttribArray(ATTRIB_VERTEX);
    var verts = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, verts);

    var NUM_HOT_COORDS = 100;
    var arr = new Float32Array(NUM_HOT_COORDS);
    var dr = (2.0 * 3.14159) / (0.5 * NUM_HOT_COORDS);
    var rad = 0.0;
    var r = 0.5;
    for (var i = 0; i < NUM_HOT_COORDS;){
        var x = r * Math.cos(rad);
        var y = r * Math.sin(rad);
        arr[i] = x;
        arr[i + 1] = y;
        i += 2;
        rad += dr;
    }

    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.vertexAttribPointer(ATTRIB_VERTEX, 2, gl.FLOAT, false, 0, 0);

    gl.lineWidth(4.0);
    gl.drawArrays(gl.LINE_LOOP, 0, NUM_HOT_COORDS / 2);

}

function arrayToFloat32(array){
    // Float32Array.from is not widely supported so this is a simple
    // reimplementation.
    var n = array.length;
    var buff = new Float32Array(n);
    for(var i = 0; i < n; i++){
        buff[i] = array[i];
    }

    return buff;
}

function initVertexBuffers(gl, state){
    var vertices = arrayToFloat32([
       -1.0, -1.0,
        1.0, -1.0,
       -1.0,  1.0,
        1.0,  1.0,]);

    var texcoords = arrayToFloat32([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0]);

    state.vertbuffer = gl.createBuffer();
    state.texbuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, state.vertbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(ATTRIB_VERTEX, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(ATTRIB_VERTEX);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.texbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(ATTRIB_TEXCOORD, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(ATTRIB_TEXCOORD);
}

function drawFullScreenQuad(gl, state){
    gl.bindBuffer(gl.ARRAY_BUFFER, state.vertbuffer);
    gl.vertexAttribPointer(ATTRIB_VERTEX, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(ATTRIB_VERTEX);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.texbuffer);
    gl.vertexAttribPointer(ATTRIB_TEXCOORD, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(ATTRIB_TEXCOORD);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function loadTexture(gl, src, renderstate) {

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    //gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP);
    //gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP);

    glerror(gl, "tex1");

    var image = new Image();
    texture.hasLoaded = false;

    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        glerror(gl, "Error from glBindTexture when loading " + src);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        glerror(gl, "Error from glTexImage2D when loading " + src);
        texture.hasLoaded = true;
        if(renderstate.allTexturesLoaded()){
            initAfterTexturesLoaded(gl, renderstate);
        }
        //draw(gl);
    };

    image.src = src;
    return texture;
}

function tick(state){
    var tmp = state.pingtex;
    state.pingtex = state.pongtex;
    state.pongtex = tmp;

    state.offsetx += state.upx * 3.0;
    state.offsety += state.upy * 3.0;
}

function go(){
    var gl = init();
    if(!gl)
        return;
}

function onDeviceMotion(renderstate, event){
    var k = 0.1;
    var a = event.accelerationIncludingGravity;

    // if(navigator.userAgent.match(/(iPad|iPhone|iPod)/gi)){
    //     // Mobile Safari has y direction reversed compared to Android.
    //     a.y = -a.y;
    //     a.x = -a.x;
    //     a.z = -a.z;
    // }

    var xgrav = renderstate.gravity.x;
    var ygrav = renderstate.gravity.y;
    var zgrav = renderstate.gravity.z;
    
    if(renderstate.firstAccelerationEvent){
            renderstate.firstAccelerationEvent = false;
            renderstate.gravity.x = a.x;
            renderstate.gravity.y = a.y;
            renderstate.gravity.z = a.z;
    }
    else{
            renderstate.gravity.x = ((a.x * k) + (xgrav * (1.0 - k)));
            renderstate.gravity.y = ((a.y * k) + (ygrav * (1.0 - k)));
            renderstate.gravity.z = ((a.z * k) + (zgrav * (1.0 - k)));
    }

    updateDownVector(renderstate);
}

function onStroke(gl, renderstate, width, start, end){
    var halfWidth = renderstate.texWidth / 2.0;
    var halfHeight = renderstate.texHeight / 2.0;
    var x = -1.0 + (start.x / halfWidth);
    var y =  1.0 - (start.y / halfHeight);
    var vx = 0;
    var vy = 0;

    if (end.x == start.x && end.y == start.y){
        vx = 0.0;
        vy = 0.0;
    } else {
        vx =   (end.x - start.x) / halfWidth;
        vy = -((end.y - start.y) / halfHeight);
    }

    var touches = [{x: x, y: y, vx: vx, vy: vy}];

    renderToEmberTexture(gl, renderstate);
    drawStrokes(gl, renderstate, width, touches);
}

function drawStrokes(gl, renderstate, width, touches){
    var count = 1;
    var vertices = new Float32Array(8 * count);
    var indices = new Uint16Array(6 * count);
    var j = 0;
    var k = 0;
    var EPS = 1e-5;

    for(var i = 0; i < count; i++){
        var vx = touches[i].vx;
        var vy = touches[i].vy;
        var x = touches[i].x;
        var y = touches[i].y;
        var mag = Math.sqrt((vx * vx) + (vy * vy));
        var sx, sy, tx, ty;
        if(mag < EPS){
            sx = ty = 0.0;
            sy = width;
            tx = width;
            vx = vy = 0.0;
        }else{
            var invm = 1.0 / mag;
            var nx = invm * vx;
            var ny = invm * vy;
            sx = - width * ny;
            sy = width * nx;
            tx = nx * width;
            ty = ny * width;
        }

        vertices[j++] = x + vx + sx + tx; // C.x
        vertices[j++] = y + vy + sy + ty; // C.y
        vertices[j++] = x + sx - tx;      // B.x
        vertices[j++] = y + sy - ty;      // B.y
        vertices[j++] = x - (tx + sx);    // A.x
        vertices[j++] = y - (ty + sy);    // A.y
        vertices[j++] = x + vx + tx - sx; // D.x
        vertices[j++] = y + vy + ty - sy; // D.y

        indices[k++] = 0 + (i * 4);
        indices[k++] = 1 + (i * 4);
        indices[k++] = 2 + (i * 4);
        indices[k++] = 2 + (i * 4);
        indices[k++] = 3 + (i * 4);
        indices[k++] = 0 + (i * 4);
    }

    gl.enableVertexAttribArray(ATTRIB_VERTEX);
    var vertbuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(ATTRIB_VERTEX, 2, gl.FLOAT, false, 0, 0);

    var indexbuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexbuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
    gl.drawElements(gl.TRIANGLES, 6 * count, gl.UNSIGNED_SHORT, 0);
}


function updateDownVector(renderstate){
    var x = renderstate.gravity.x;
    var y = renderstate.gravity.y;
    var mag = Math.sqrt((x * x) + (y * y));

    if(mag < 0.11){
        // Device is face up, parallell to the ground
        // nx =  0.0;
        // ny = -1.0;
    }else{
        var nx = x / mag;
        var ny = y / mag;
        renderstate.upx = nx * (1.0 / renderstate.texWidth);
        renderstate.upy = ny * (1.0 / renderstate.texHeight);
    }
}

function putOutFire(gl, renderstate){
    renderToEmberTexture(gl, renderstate);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}
    
