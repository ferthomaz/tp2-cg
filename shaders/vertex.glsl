#version 300 es
in vec4 position;
in vec3 normal;
in vec2 texcoord;
uniform mat4 u_worldViewProjection;
uniform mat4 u_world;
uniform mat4 u_worldInverseTranspose;
out vec3 v_normal;
out vec3 v_worldPosition;
out vec2 v_texcoord;
void main() {
  gl_Position = u_worldViewProjection * position;
  v_worldPosition = (u_world * position).xyz;
  v_normal = mat3(u_worldInverseTranspose) * normal;
  v_texcoord = texcoord;
}
