#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_worldPosition;
in vec2 v_texcoord;
uniform vec3 u_color;
uniform sampler2D u_texture;
uniform vec3 u_cameraPosition;
uniform vec3 u_lightDirection;
uniform bool u_lighting;
uniform bool u_fog;
uniform bool u_sky;
uniform bool u_unlit;
uniform float u_shininess;
uniform float u_specular;
uniform vec3 u_fogColor;
out vec4 outColor;
void main() {
  vec4 texel = texture(u_texture, v_texcoord);
  if (texel.a < 0.01) discard;
  vec3 color = u_color * texel.rgb;
  if (u_lighting && !u_sky && !u_unlit) {
    vec3 n = normalize(v_normal);
    vec3 l = normalize(u_lightDirection);
    vec3 v = normalize(u_cameraPosition - v_worldPosition);
    float diffuse = max(dot(n, l), 0.0);
    // Phong: ambiente + difusa + especular (reflexao da luz)
    float specular = 0.0;
    if (diffuse > 0.0) {
      specular = pow(max(dot(reflect(-l, n), v), 0.0), u_shininess);
    }
    color = color * (0.48 + 0.52 * diffuse) + vec3(u_specular * specular);
  }
  if (u_fog) {
    float distanceToCamera = length(u_cameraPosition - v_worldPosition);
    float amount = u_sky ? 0.45 : smoothstep(10.0, 32.0, distanceToCamera);
    color = mix(color, u_fogColor, amount);
  }
  outColor = vec4(color, texel.a);
}
