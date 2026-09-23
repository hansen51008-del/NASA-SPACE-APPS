// One GPU atlas serves every terrain marker. All dimensions are decorative;
// they do not represent measured flame height, wind, or burned area.
// 2x linear resolution keeps close-up sprites crisp on high-DPI displays.
const WIDTH = 256;
const HEIGHT = 384;
const vertex = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`;
const fragment = `precision highp float;
uniform float time;
uniform vec2 spriteSize;
uniform float cameraPitch;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
  float n=0.; float a=.55;
  for(int i=0;i<5;i++) { n+=a*noise(p); p=mat2(1.6,-1.2,1.2,1.6)*p+7.3; a*=.5; }
  return n;
}
void main() {
  vec2 cell=floor(gl_FragCoord.xy/spriteSize);
  vec2 uv=mod(gl_FragCoord.xy,spriteSize)/spriteSize;
  float t=time*.65+cell.x*7.13+cell.y*13.71;
  float lift=sin(cameraPitch);
  float verticalScale=mix(.24,1.,lift);
  float y=clamp((uv.y-.075)/verticalScale,-.15,1.2);
  float x=(uv.x-.5)*1.65;
  // Domain-warped fuel: each moving edge breaks into small, rising tongues.
  float curl=fbm(vec2(x*5.,y*5.-t*.8))-.5;
  float fuel=fbm(vec2(x*9.+curl*2.,y*7.-t*2.3));
  float ridge=abs(x-y*.17+curl*y*.32);
  float envelope=1.-ridge/(.36-max(y,0.)*.28)-y*2.55;
  float filaments=noise(vec2(x*38.+curl*3.,y*24.-t*4.));
  float lobes=sin(x*27.+t*.7)*.045+sin(x*43.-t)*.025;
  float density=envelope+(fuel-.54)*1.8+(filaments-.5)*.12+lobes;
  float flame=smoothstep(.05,.3,density)*smoothstep(-.015,.025,y)*(1.-smoothstep(.57,.72,y));
  float heat=clamp(density*.95+(filaments-.5)*.16,0.,1.);
  vec3 fire=mix(vec3(.86,.085,.008),vec3(1.,.42,.018),smoothstep(.12,.5,heat));
  fire=mix(fire,vec3(1.,.63,.2),smoothstep(.48,.85,heat));
  // Rolling smoke broadens above the flame, with a warm lower edge.
  float sx=x-y*.27-sin(y*10.-t*.6)*.04;
  float wisps=fbm(vec2(sx*9.,y*8.-t*.48));
  float smoke=exp(-sx*sx/(.012+max(y,0.)*.07))*smoothstep(.13,.32,y)
    *(1.-smoothstep(.65,.94,y))*smoothstep(.15,.65,wisps)*.55;
  vec3 smokeColour=mix(vec3(.12,.135,.13),vec3(.58,.57,.52),wisps);
  float halo=exp(-x*x*22.-(y-.15)*(y-.15)*35.)*.035;
  vec3 premul=smokeColour*smoke+vec3(1.,.23,.018)*halo*(1.-smoke);
  float alpha=smoke+halo*(1.-smoke);
  premul=fire*flame+premul*(1.-flame); alpha=flame+alpha*(1.-flame);
  // Looking down reveals the glowing fuel bed; upright flames foreshorten.
  vec2 bed=vec2(x,(uv.y-.075)*mix(3.8,11.,lift));
  float bedNoise=fbm(bed*12.+vec2(t*.4,-t*.65));
  float bedAlpha=(1.-smoothstep(.10,.34,length(bed)+(bedNoise-.5)*.12))*.85;
  vec3 bedColour=mix(vec3(.65,.045,.005),vec3(1.,.64,.12),bedNoise);
  premul+=bedColour*bedAlpha*(1.-alpha); alpha+=bedAlpha*(1.-alpha);
  // Sparse ballistic embers; no repeated CSS sparkle pattern.
  for(int i=0;i<4;i++) {
    float seed=float(i)+cell.x*9.+cell.y*19.;
    float age=fract(t*(.19+hash(vec2(seed,2.))*.1)+seed*.173);
    vec2 ember=vec2((hash(vec2(seed,1.))-.5)*.32+age*.22, .1+age*.69);
    ember.x+=sin(age*12.+seed)*.027;
    vec2 d=(vec2(x,y)-ember)*vec2(1.,.6);
    float spark=(1.-smoothstep(.002,.01,length(d)))*sin(age*3.14159)*.5;
    premul=vec3(1.,.65,.16)*spark+premul*(1.-spark); alpha=spark+alpha*(1.-spark);
  }
  float edge=smoothstep(0.,.04,uv.x)*(1.-smoothstep(.96,1.,uv.x));
  gl_FragColor=vec4(premul*edge,alpha*edge);
}`;

export function createFireRenderer() {
  const atlas = document.createElement("canvas");
  atlas.width = WIDTH * 2;
  atlas.height = HEIGHT * 2;
  const gl = atlas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  const dispose = () => {
    if (!gl) return;
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  if (gl) {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Fire shader unavailable");
      return shader;
    };
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Fire program unavailable");
      gl.useProgram(program);
      gl.uniform2f(gl.getUniformLocation(program, "spriteSize"), WIDTH, HEIGHT);
      gl.viewport(0, 0, atlas.width, atlas.height);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const time = gl.getUniformLocation(program, "time");
      const pitch = gl.getUniformLocation(program, "cameraPitch");
      return {
        render(seconds: number, pitchDegrees = 60) {
          gl.uniform1f(time, seconds);
          gl.uniform1f(pitch, (pitchDegrees * Math.PI) / 180);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
        paint(ctx: CanvasRenderingContext2D, variant: number) {
          ctx.clearRect(0, 0, WIDTH, HEIGHT);
          ctx.drawImage(
            atlas,
            (variant % 2) * WIDTH,
            Math.floor(variant / 2) * HEIGHT,
            WIDTH,
            HEIGHT,
            0,
            0,
            WIDTH,
            HEIGHT,
          );
        },
        dispose,
        engine: "shader",
      };
    } catch {
      dispose();
    }
  }
  // A second WebGL context is optional: retain a small ember symbol if the
  // device cannot allocate one. The MapLibre detections still remain visible.
  return {
    render(_seconds: number) {},
    paint(ctx: CanvasRenderingContext2D, _variant: number) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      const glow = ctx.createRadialGradient(
        WIDTH * 0.5,
        HEIGHT * 0.9,
        0,
        WIDTH * 0.5,
        HEIGHT * 0.9,
        WIDTH * 0.21,
      );
      glow.addColorStop(0, "#fff2a9");
      glow.addColorStop(0.25, "#ff9b24");
      glow.addColorStop(1, "#ff450000");
      ctx.fillStyle = glow;
      ctx.fillRect(0, HEIGHT * 0.7, WIDTH, HEIGHT * 0.3);
    },
    dispose() {},
    engine: "ember",
  };
}

export const fireCanvasSize = { width: WIDTH, height: HEIGHT };
