// src/App.js
import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

// 第一人称控制组件（鼠标拖拽旋转 + 键盘移动 + 滚轮缩放）
function FirstPersonControls({ speed = 0.2, zoomSpeed = 2.5 }) {
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const pitch = useRef(0); // 上下旋转角度
  const yaw = useRef(0);   // 左右旋转角度
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // 初始化相机角度
  useEffect(() => {
    yaw.current = 0;
    pitch.current = 0;
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break;
        case 'KeyS': moveState.current.backward = true; break;
        case 'KeyA': moveState.current.left = true; break;
        case 'KeyD': moveState.current.right = true; break;
        default: break;
      }
    };
    const handleKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break;
        case 'KeyS': moveState.current.backward = false; break;
        case 'KeyA': moveState.current.left = false; break;
        case 'KeyD': moveState.current.right = false; break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 鼠标事件：左键拖拽旋转，滚轮缩放
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e) => {
      if (e.button === 0) { // 左键
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      const sensitivity = 0.005;
      yaw.current -= dx * sensitivity;
      pitch.current -= dy * sensitivity;
      // 限制俯仰角，防止翻转
      pitch.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch.current));
      
      // 应用旋转：欧拉角顺序 YXZ（偏航、俯仰、滚转）
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
      
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = 'default';
    };

    // 滚轮缩放（修改方向：向下滚动为缩小，向上滚动为放大）
    const handleWheel = (e) => {
      // 注意：去掉了负号，使方向与Blender一致
      const delta = Math.sign(e.deltaY) * zoomSpeed;
      const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(direction, delta);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [camera, gl, zoomSpeed]);

  // 每帧移动相机
  useFrame(() => {
    const direction = new THREE.Vector3();
    // 获取相机当前的前向和右向向量（忽略垂直分量）
    const front = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    front.y = 0;
    right.y = 0;
    front.normalize();
    right.normalize();

    if (moveState.current.forward) direction.add(front);
    if (moveState.current.backward) direction.sub(front);
    if (moveState.current.left) direction.sub(right);
    if (moveState.current.right) direction.add(right);

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(speed);
      camera.position.add(direction);
    }
  });

  return null; // 不渲染任何内容
}

// 加载模型并处理信息牌的组件
function CampusModel() {
  // 请将模型文件放在 public/models/ 目录下，并修改这里的文件名
  const { scene } = useGLTF('/models/your-campus.glb');

  const [infoPoints, setInfoPoints] = useState([]);

  // 模型加载后，遍历所有子物体，提取信息牌数据
  useEffect(() => {
    if (scene) {
      const points = [];
      scene.traverse((child) => {
        // 判断是否是信息牌：物体名称以 'info_' 开头
        if (child.isObject3D && child.name.startsWith('info_')) {
          // 兼容多种属性读取方式
          const title = child.userData?.title || child.title || '未命名地点';
          points.push({
            position: child.position.clone(), // 获取世界坐标
            title: title,
          });
        }
      });
      setInfoPoints(points);
      console.log('找到信息点:', points);
    }
  }, [scene]);

  return (
    <>
      {/* 渲染模型本身 */}
      <primitive object={scene} />

      {/* 在对应位置显示HTML信息牌（已放大） */}
      {infoPoints.map((point, index) => (
        <Html
          key={index}
          position={point.position}
          center
          distanceFactor={8}      // 数值越小，标签越明显
          scale={1.5}             // 整体放大1.5倍
        >
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '30px',
            fontSize: '24px',
            border: '3px solid gold',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            transform: 'translateY(-30px)' // 让标签悬浮在物体上方
          }}>
            {point.title}
          </div>
        </Html>
      ))}
    </>
  );
}

// 主组件
function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [10, 5, 15], fov: 60 }}
        shadows
      >
        {/* 环境光与方向光 */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />

        {/* 使用自定义第一人称控制 */}
        <FirstPersonControls speed={0.3} zoomSpeed={6.0} />

        {/* 加载校园模型和信息牌 */}
        <CampusModel />

        {/* 可选：添加地面网格辅助 */}
        <gridHelper args={[100, 20]} />
      </Canvas>
    </div>
  );
}

export default App;
