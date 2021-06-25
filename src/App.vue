<template>
  <el-container>
    <el-aside width="200px">
        <div class="upload">
          <input
            type="file"
            id="fileElem"
            multiple
            style="display:none;"
            accept="image/*"
            :files='imgList'
            @change="selectChange"
          />
          <el-button @click="fileSelect" plain>上传图片</el-button>
        </div>
      <ul class="imgList">
        <li
        v-for="(item,index) in imgList"
        :key="item.name"
        class="imgItem"
      >
        <img :src="item.imgUrl" class="image" @click="selectImg(item,index)" />
        <div class="desc">
          <span>{{item.index + 1}} : {{ item.name }}</span>
          <div class="bottom">
            <span class="time">{{ item.date }}</span>
            <el-button type="text" class="button" @click="deleteImg(item,index)">删除</el-button>
          </div>
        </div>
      </li>
      </ul>
    </el-aside>
    <el-container>
      <el-header class="control operation">
        <div class="ctlItem modeGroup">
          <el-radio-group class="radioGroup" v-model="OIMode">
            <el-radio :label="0" >普通模式</el-radio>
            <el-radio :label="1" >标注模式</el-radio>
          </el-radio-group>
        </div>
        <div class="ctlItem" v-for="item in operationList" :key='item.name' @click="operation(item)">
          <svg class="icon" aria-hidden="true">
            <use :xlink:href="'#'+item.icon"></use>
          </svg>
        </div>

      </el-header>
      <el-main>
        <canvas id="canvas"></canvas>
      </el-main>
      <el-footer class="control draw" ref="footer">
        <div class="ctlItem modeGroup">
          <el-radio-group class="radioGroup" v-model="SFMode">
            <el-radio :label="0" >边框模式</el-radio>
            <el-radio :label="1" >填充模式</el-radio>
          </el-radio-group>
        </div>
        <div class="ctlItem" v-for="item in drawList" :key='item.name' @click="operation(item)">
          <svg class="icon" aria-hidden="true">
            <use :xlink:href="'#'+item.icon"></use>
          </svg>
        </div>
        <div class="ctlItem widthPicker" @click="selectStrokeWidth">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-gudingdaxiao"></use>
          </svg>
          <el-input-number class="hiddenCtl" id="widthPicker" v-model="penWidth" :min="1" :max="50" v-show="showWidthPicker" controls-position="right" @change="widthChange" @mouseout="mouseOut"  @mouseover="showWidthPicker = true"></el-input-number>
        </div>
        <div class="ctlItem colorPicker" @click="selectColor">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-yansefangan"></use>
          </svg>
          <input class="hiddenCtl" id="colorPicker" type="color" v-model="penColor" @change="colorChange" style="width:0;visibility:hidden;">
        </div>
      </el-footer>
    </el-container>
  </el-container>
</template>

<script lang="javascript">
import {
  defineComponent, reactive, computed, ref, onMounted,
} from 'vue';
import { fabric } from 'fabric';
import { ElMessage } from 'element-plus';
import format from './utils/utils';

export default defineComponent({
  name: 'App',
  setup() {
    let imgList = reactive([]); // 图片列表
    // let count:number = 0; // 计算图片数量
    let currentImg = computed(() => imgList[0]); // cnavas当前需要显示的图片
    let canvasBox; // canvas元素
    // eslint-disable-next-line prefer-const
    let pointCol = {
      startPoint: {},
      endPoint: {},
    }; // 一次绘制的开始点结束点集合
    let operationMode; // 当前操作模式
    // let drawMode; // 当前绘画模式
    let drawingObj; // 正在画的对象
    let isDrawing = false; // 标示是否正在画
    const backgroundColor = '#EBF5FF'; // 画布的背景颜色
    const canvasWidth = 980;
    const cnavasHeight = 530;
    const penColor = ref('#000'); // 画笔颜色
    const penWidth = ref(1); // 画笔宽度
    const fontSize = 12; // 字体大小
    let textBox = null; // 文本框
    let polPointArray = []; // 存放多边形的点集合
    // eslint-disable-next-line prefer-const
    let polLineArray = []; // 存放多边形临时线段
    let polStartCircle; // 以多边形的起始点生成一个范围圆，方便多边形闭合
    let colorPickerEl; // 取色器 dom
    // eslint-disable-next-line prefer-const
    let showWidthPicker = ref(false); // 字体大小input的显隐
    let goBackTag = -1; // 记录前进回撤
    // let imgList = []; // 图片列表 其中list属性用于保存该图片的saveList
    let saveList = []; // 点击save保存的canvas列表，每次点击保存都会记录一次
    let canvasList = []; // 保存序列化的canvas，每次改变都会记录一次（放大缩小除外）
    let selectedImgIndex = 0; // 被选择的图片序号
    const needSerialization = ['freeDraw', 'line', 'rect', 'circle', 'triangle']; // 这些操作模式下，每次鼠标抬起需要序列化
    let isInit = true; // 该图片是否是第一次出现
    let fileElem; // 文件上传input dom
    let isMoving = false; // 标志move模式下是否正在移动
    let OIMode = ref(0); // 0代表普通模式，1代表图形标注模式，标注模式下会限制标注只能在图形范围内
    let startInBound = true; // 绘制起始点是否在范围内
    let moveInBound = true; // 绘制过程中是否超出范围
    let endInBound = true; // 绘制结束图形是否在范围内
    const needAlert = ['freeDraw', 'line', 'rect', 'circle', 'triangle', 'polygon', 'text']; // 超出范围需要提示的操作模式
    let SFMode = ref(0); // 0代表stroke模式，1代表fill填充模式
    let widthChanged = false; // width是否改变

    const drawList = [ // 绘图类型
      {
        name: 'freeDraw',
        icon: 'icon-fei',
        desc: '自由绘制',
      }, {
        name: 'line',
        icon: 'icon-chu',
        desc: '直线',
      }, {
        name: 'text',
        icon: 'icon-wenben',
        desc: '文本',
      }, {
        name: 'rect',
        icon: 'icon-tx-zhengfangxing',
        desc: '矩形',
      }, {
        name: 'circle',
        icon: 'icon-tx-yuanxing',
        desc: '圆',
      }, {
        name: 'triangle',
        icon: 'icon-tx-sanjiaoxing',
        desc: '三角形',
      }, {
        name: 'polygon',
        icon: 'icon-tx-wubianxing',
        desc: '多边形',
      },
      // { // 画星星
      //   name: 'star',
      //   icon: 'icon-tx-wujiaoxingxing',
      // },
    ];
    const operationList = [ // 操作类型
      {
        name: 'select',
        icon: 'icon-xuanze',
        desc: '选择',
      }, {
        name: 'eraser',
        icon: 'icon-shilianghuaxian',
        desc: '擦除',
      }, {
        name: 'move',
        icon: 'icon-manyou',
        desc: '移动',
      }, {
        name: 'toSmall',
        icon: 'icon-suoxiao',
        desc: '缩小',
      }, {
        name: 'toLarge',
        icon: 'icon-fangda',
        desc: '放大',
      }, {
        name: 'goBack',
        icon: 'icon-zhongzuo',
        desc: '后撤',
      }, {
        name: 'goForward',
        icon: 'icon-chexiao',
        desc: '前进',
      }, {
        name: 'save',
        icon: 'icon-tubiaowenjian',
        desc: '保存',
      }, {
        name: 'download',
        icon: 'icon-dakaiwendang',
        desc: '下载',
      },
    ];

    // 初始化canvas
    function initCanvas() {
      canvasBox = new fabric.Canvas('canvas', {
        backgroundColor,
        width: canvasWidth,
        height: cnavasHeight,
        selection: false,
      });
    }

    // 置空pointCol
    function pointColSetNull() {
      pointCol.startPoint = {};
      pointCol.endPoint = {};
    }

    // 重置文本框
    function initTextbox() {
      if (textBox !== null) {
        textBox.editable = false;
        textBox.exitEditing();
        textBox = null;
      }
    }

    // 序列化canvas
    function serializationCanvas() {
      canvasList.push(JSON.stringify(canvasBox.toJSON()));
    }

    // 反序列化canvas
    function deserializationCanvas(json) {
      canvasBox.loadFromJSON(
        JSON.parse(json),
        canvasBox.renderAll.bind(canvasBox),
        (o, object) => {
          object.selectable = false;
          if (Object.getPrototypeOf(object).type === 'image') { // 如果是图片
            object.scaleToWidth(750).set({ left: 0, top: 0 });
          }
        },
      );
    }

    // 改变canvas尺寸
    function changeZoom(zoom) {
      let zom = zoom;
      if (zom > 10) {
        zom = 10;
      } else if (zom < 0.01) {
        zom = 0.01;
      }
      let scaleCenterPoint = new fabric.Point(canvasWidth / 2, cnavasHeight / 2);
      canvasBox.zoomToPoint(scaleCenterPoint, zom);
    }

    // 清空canvas：删除canvas所有元素
    function clearCanvas(canvas) {
      const allObj = canvas.getObjects();
      allObj.forEach((item) => {
        canvas.remove(item);
      });
    }

    // 连续绘制过程canvas添加对象
    function addObj(canvas, obj) {
      if (drawingObj) { // 画直线是每次移动画一条线，如果正在画直线，删除上一次画的对象，只保留当前直线
        canvasBox.remove(drawingObj);
      }
      drawingObj = obj;
      canvas.add(obj);
    }

    // canvas渲染一张图片：如果canvas中有其他元素，则清空其他元素再渲染
    function addImg(canvas, url) {
      fabric.Image.fromURL(url, (canvasImg) => {
        canvasImg.scaleToWidth(750).set({ left: 0, top: 0 });
        canvasImg.selectable = false;
        if (canvas.getObjects().length === 0) {
          canvas.add(canvasImg);
        } else { // 如果canvas中有其他元素，则清空其他元素再渲染
          clearCanvas(canvas);
          canvas.add(canvasImg);
        }

        if (isInit) {
          serializationCanvas();
          saveList.push(JSON.stringify(canvasBox.toJSON()));
        }
      });
    }

    // 将base64转为blob
    function dataURLtoBlob(dataurl) {
      let arr = dataurl.split(','); // 把base64分成两部门，头（包含源文件类型信息），ASCII 字符串（文件数据）部分
      let mime = arr[0].match(/:(.*?);/)[1]; // 获取文件类型
      let bstr = atob(arr[1]); // 通过base-64编码的字符串数据，获取二进制数据“字符串”
      let n = bstr.length; // 获取字符串长度
      let u8arr = new Uint8Array(n); // 获取二进制编码数组
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n); // 获取制定位置字符串的unicode编码
      }
      return new Blob([u8arr], { type: mime });
    }
    // 给文件添加创建时间和文件名
    function addFileInfo(blob, fileName) {
      blob.lastModifiedDate = new Date();
      blob.name = fileName;
      return blob;
    }

    // 获取图片
    function getImg() {
      let objList = canvasBox.getObjects();
      return objList.filter((item) => Object.getPrototypeOf(item).type === 'image')[0];
    }

    // 获取边界
    function getBound() {
      // eslint-disable-next-line vue/no-ref-as-operand
      if (currentImg.value) {
        let img = getImg();
        let imgLeft = img.getBoundingRect().left;
        let imgTop = img.getBoundingRect().top;
        let imgRight = imgLeft + img.getBoundingRect().width;
        let imgBottom = imgTop + img.getBoundingRect().height;
        return {
          left: imgLeft, top: imgTop, right: imgRight, bottom: imgBottom,
        };
      }
      return { // 图片不存在则以canvas为边界
        left: 0, top: 0, right: canvasBox.width, bottom: canvasBox.height,
      };
    }

    // 判断某点是否在范围内
    // point:{x,y}  相对于canvas的点
    function pointIsInnerBound(point) {
      let bound = getBound();
      if (
        point.x < bound.left
        || point.x > bound.right
        || point.y < bound.top
        || point.y > bound.bottom
      ) {
        return false;
      }
      return true;
    }

    function drawLine() {
      const line = new fabric.Line([pointCol.startPoint.x, pointCol.startPoint.y, pointCol.endPoint.x, pointCol.endPoint.y], {
        stroke: penColor.value,
        strokeWidth: penWidth.value,
        selectable: false,
      });
      if (operationMode === 'polygon') {
        polLineArray.push(line); // 保存多边形的临时线段
      }
      addObj(canvasBox, line);
    }

    function drawText() {
      textBox = new fabric.Textbox('', {
        left: pointCol.startPoint.x,
        top: pointCol.startPoint.y,
        fontSize,
        stroke: penColor.value,
        strokeWidth: penWidth.value,
        selectable: false,
      });
      canvasBox.add(textBox);
      textBox.enterEditing();
    }

    function drawRect() {
      let XPositive = pointCol.endPoint.x - pointCol.startPoint.x > 0; // 判定鼠标移动方向
      let YPositive = pointCol.endPoint.y - pointCol.startPoint.y > 0; // 判定鼠标移动方向
      const rect = new fabric.Rect({
        left: XPositive ? pointCol.startPoint.x : pointCol.endPoint.x,
        top: YPositive ? pointCol.startPoint.y : pointCol.endPoint.y,
        width: Math.abs(pointCol.endPoint.x - pointCol.startPoint.x),
        height: Math.abs(pointCol.endPoint.y - pointCol.startPoint.y),
        fill: SFMode.value ? penColor.value : 'rgba(0, 0, 0, 0)',
        stroke: penColor.value,
        strokeWidth: penWidth.value,
        selectable: false,
      });
      addObj(canvasBox, rect);
    }

    function drawCircle() {
      let XPositive = pointCol.endPoint.x - pointCol.startPoint.x > 0; // 判定鼠标移动方向
      let YPositive = pointCol.endPoint.y - pointCol.startPoint.y > 0; // 判定鼠标移动方向
      const circle = new fabric.Circle({
        left: XPositive ? pointCol.startPoint.x : pointCol.endPoint.x,
        top: YPositive ? pointCol.startPoint.y : pointCol.endPoint.y,
        fill: SFMode.value ? penColor.value : 'rgba(0, 0, 0, 0)',
        stroke: penColor.value,
        strokeWidth: penWidth.value,
        radius: Math.abs(pointCol.endPoint.x - pointCol.startPoint.x) / 2,
        selectable: false,
      });
      addObj(canvasBox, circle);
    }

    function drawTriangle() {
      let XPositive = pointCol.endPoint.x - pointCol.startPoint.x > 0; // 判定鼠标移动方向
      let YPositive = pointCol.endPoint.y - pointCol.startPoint.y > 0; // 判定鼠标移动方向
      const triangle = new fabric.Triangle({
        left: XPositive ? pointCol.startPoint.x : pointCol.endPoint.x,
        top: YPositive ? pointCol.startPoint.y : pointCol.endPoint.y,
        fill: SFMode.value ? penColor.value : 'rgba(0, 0, 0, 0)',
        stroke: penColor.value,
        strokeWidth: penWidth.value,
        height: Math.abs(pointCol.endPoint.y - pointCol.startPoint.y),
        width: (Math.sqrt(3) * 2 * Math.abs(pointCol.endPoint.y - pointCol.startPoint.y)) / 3,
        selectable: false,
      });
      addObj(canvasBox, triangle);
    }

    function drawPolygon() {
      const polygon = new fabric.Polygon([...polPointArray], {
        fill: SFMode.value ? penColor.value : 'rgba(0, 0, 0, 0)',
        stroke: penColor.value,
        strokeWidth: penWidth.value,
        selectable: false,
      });
      canvasBox.add(polygon);
    }

    function selectStrokeWidth() {
      showWidthPicker.value = true;
    }

    function selectColor() {
      showWidthPicker.value = false;
      colorPickerEl.click();
    }

    function toSmall() {
      let zoom = canvasBox.getZoom() - 0.05;
      changeZoom(zoom);
    }

    function toLarge() {
      let zoom = canvasBox.getZoom() + 0.05;
      changeZoom(zoom);
    }

    function goBack() {
      if (!OIMode.value) {
        if (-goBackTag === canvasList.length) {
          ElMessage.warning('已经是初始状态！');
          return;
        }
        goBackTag--;

        deserializationCanvas(canvasList.slice(goBackTag, goBackTag + 1)[0]);
      } else {
        if (-(goBackTag - 1) === canvasList.length) { // 标注模式下，回撤到图片初始状态时提示
          ElMessage.warning('已经是第一个记录！');
          return;
        }
        goBackTag--;

        deserializationCanvas(canvasList.slice(goBackTag, goBackTag + 1)[0]);
      }
    }
    function goForward() {
      if (goBackTag === -1) {
        ElMessage.warning('已经是最后一个记录！');
        return;
      }
      goBackTag++;

      goBackTag === -1 ? deserializationCanvas(canvasList.slice(goBackTag)[0]) : deserializationCanvas(canvasList.slice(goBackTag, goBackTag + 1)[0]);
    }
    function save() {
      if (operationMode === 'text') { // 点击保存，保存该文本框，销毁文本框对象
        initTextbox();
        serializationCanvas();
      }
      saveList.push(goBackTag === -1 ? canvasList.slice(goBackTag)[0] : canvasList.slice(goBackTag, goBackTag + 1)[0]);
      canvasList = [...saveList];
      imgList.forEach((item, index) => {
        if (index === selectedImgIndex) {
          item.list = [...saveList];
        }
      });
      goBackTag = -1;
    }
    function download() {
      let url = canvasBox.toDataURL();
      let blob = dataURLtoBlob(url);

      addFileInfo(blob, 'canvas.png');
      let eElem = document.createElement('a');
      eElem.download = 'canvas.png';
      eElem.style.display = 'none';
      eElem.href = URL.createObjectURL(blob);
      document.body.appendChild(eElem);
      eElem.click();
      document.body.removeChild(eElem);
    }

    function operation(ctl) {
      showWidthPicker.value = false;
      widthChanged = false;

      if (ctl.name === 'text') serializationCanvas(); // 在改变操作模式前判断操作模式如果为text，序列化文本框

      // select模式可以让所有对象可选
      if (ctl.name === 'select' || operationMode === 'select') { // 这里的operationMode在代表上一次操作模式
        let allObj = canvasBox.getObjects();
        if (ctl.name === 'select') {
          allObj.forEach((item) => {
            item.selectable = true;
          });
        } else {
          allObj.forEach((item) => {
            item.selectable = false;
          });
        }
      }

      if (!['toSmall', 'toLarge', 'goBack', 'goForward', 'save', 'download'].includes(ctl.name)) operationMode = ctl.name; // 改变操作模式
      if (operationMode === 'freeDraw') {
        canvasBox.isDrawingMode = true;
        canvasBox.freeDrawingBrush.color = penColor.value;
        canvasBox.freeDrawingBrush.width = penWidth.value;
      } else {
        canvasBox.isDrawingMode = false;
      }

      initTextbox();

      switch (ctl.name) {
        case 'toSmall':
          toSmall();
          break;
        case 'toLarge':
          toLarge();
          break;
        case 'goBack':
          goBack();
          break;
        case 'goForward':
          goForward();
          break;
        case 'save':
          save();
          break;
        case 'download':
          download();
          break;
        default:
      }
    }

    // canvas添加事件监听
    function canvasAddEvent() {
      canvasBox.on('mouse:down', (option) => {
        if (OIMode.value) startInBound = pointIsInnerBound(option.pointer);

        if (!isDrawing) {
          if (operationMode === 'polygon') {
            polPointArray.push(option.absolutePointer); // 保存多边形的初始点
            // 以起始点生成一个圆路径，当终点在该路径内时，就当作多边形闭合
            polStartCircle = new fabric.Circle({
              left: option.absolutePointer.x - 5,
              top: option.absolutePointer.y - 5,
              fill: penColor.value,
              stroke: '#fff',
              strokeWidth: 2,
              radius: 5,
              selectable: false,
            });
            canvasBox.add(polStartCircle);
          }
        }
        isDrawing = true;
        pointCol.startPoint = option.absolutePointer;

        if (operationMode === 'text') drawText();

        if (operationMode === 'eraser') {
          let objList = canvasBox.getObjects();
          objList.forEach((item) => {
            if (Object.getPrototypeOf(item).type !== 'image' && option.target === item) {
              canvasBox.remove(item);
              serializationCanvas();
            }
          });
        }

        if (operationMode === 'move') {
          isMoving = true;
          pointCol.startPoint = option.pointer;
        }
      });

      canvasBox.on('mouse:move', (option) => {
        if (operationMode === 'move' && isMoving) { // 移动图片
          let point = {
            x: (option.pointer.x - pointCol.startPoint.x) / 5,
            y: (option.pointer.y - pointCol.startPoint.y) / 5,
          };
          canvasBox.relativePan(point);
          pointCol.startPoint = option.pointer;
        }

        if (!isDrawing) return;

        // 画笔绘制过程中判断是否超出图片范围
        if (OIMode.value && ['line', 'freeDraw'].includes(operationMode) && moveInBound) {
          if (pointIsInnerBound(option.pointer)) {
            moveInBound = true;
          } else {
            moveInBound = false;
          }
        }

        pointCol.endPoint = option.absolutePointer;
        switch (operationMode) {
          case 'line':
            drawLine();
            break;
          case 'rect':
            drawRect();
            break;
          case 'circle':
            drawCircle();
            break;
          case 'triangle':
            drawTriangle();
            break;
          case 'polygon':
            // drawPolygon();
            // 以线段构成多边形，每次点击生成一个拐点
            drawLine();
            break;
          default:
        }
      });

      canvasBox.on('mouse:up', (option) => {
        isDrawing = false;
        pointCol.endPoint = option.absolutePointer;
        drawingObj = null;
        pointColSetNull();

        // 自由绘画模式中，每次落笔绘画对象不可选中
        if (operationMode === 'freeDraw') {
          canvasBox.getObjects()[canvasBox.getObjects().length - 1].selectable = false;
        }

        if (needSerialization.includes(operationMode)) serializationCanvas();

        if (operationMode === 'polygon') {
          polPointArray.push(option.absolutePointer);
          pointCol.startPoint = option.absolutePointer;
          isDrawing = true;
          const bounding = polStartCircle.getBoundingRect();
          if (polPointArray.slice(-1)[0].x >= bounding.left && polPointArray.slice(-1)[0].x <= bounding.left + bounding.width && polPointArray.slice(-1)[0].y >= bounding.top && polPointArray.slice(-1)[0].y <= bounding.top + bounding.height) {
            if (polLineArray.length <= 1) { // 如果第一个鼠标落下点在原点，则不进行绘制
              isDrawing = false;
              canvasBox.remove(polStartCircle);
              polStartCircle = null;
              drawingObj = null;
              polPointArray = [];
              polLineArray = [];
              return;
            }
            polPointArray.splice(-1, 1);
            [pointCol.endPoint] = polPointArray;
            [pointCol.startPoint] = polPointArray.slice(-1);
            isDrawing = false;
            canvasBox.remove(polStartCircle);
            polStartCircle = null;
            if (SFMode.value) {
              polLineArray.forEach((item) => {
                canvasBox.remove(item);
              });
              drawPolygon();
            } else {
              canvasBox.remove(polLineArray.slice(-1)[0]);
              drawLine();
            }
            drawingObj = null;
            polPointArray = [];
            polLineArray = [];

            serializationCanvas();
          }
        }

        if (operationMode === 'move') {
          isMoving = false;
          pointCol.startPoint = {};
        }

        if (OIMode.value) { // 标注模式下检查是否超出范围
          if (['rect', 'circle', 'triangle', 'polygon'].includes(operationMode)) { // 结束后需要检查的类型
            let obj = canvasBox.getObjects()[canvasBox.getObjects().length - 1];
            let { aCoords } = obj;
            let bound = getBound();
            endInBound = aCoords.tl.y >= bound.top && aCoords.br.y <= bound.bottom && aCoords.tl.x >= bound.left && aCoords.br.x <= bound.right;
          }

          if (!moveInBound || !startInBound || !endInBound) {
            // 绘制的标注超出图形范围

            if (needAlert.includes(operationMode)) {
              ElMessage.error('请勿超出标注范围！');
              canvasBox.remove(canvasBox.getObjects()[canvasBox.getObjects().length - 1]); // 删除刚刚绘制的不合格标注
              if (polStartCircle) canvasBox.remove(polStartCircle);
              isDrawing = false;
              polStartCircle = null;
              drawingObj = null;
              polPointArray = [];
              polLineArray = [];
              moveInBound = true;
              startInBound = true;
              endInBound = true;
            }
          }
        }
      });

      canvasBox.on('mouse:wheel', (option) => {
        option.e.preventDefault();
        let delta = option.e.deltaY > 0 ? -0.01 : 0.01;
        let zoom = canvasBox.getZoom() + delta;
        changeZoom(zoom);
      });
    }

    /**
     * DOM绑定事件
     */

    // 图片列表改变
    function selectChange(event) {
      let fileList = event.target.files;

      if (!fileList.length) {
        imgList = [];
      } else {
        for (let index = 0; index < fileList.length; index++) {
          imgList.push({
            ...fileList[index],
            index,
            name: fileList[index].name,
            date: format(new Date(), 'yyyy-MM-dd'),
            imgUrl: window.URL.createObjectURL(fileList[index]),
          });
        }
        currentImg = ref(imgList[0]);
      }
      addImg(canvasBox, currentImg.value.imgUrl);
    }

    // 选择一张图片
    function selectImg(img, index) {
      selectedImgIndex = index;
      currentImg = ref(img);
      clearCanvas(canvasBox);
      imgList.forEach((item, ind) => {
        if (ind === selectedImgIndex) {
          if ('list' in item) {
            canvasList = [...item.list];
            isInit = false;
          } else {
            canvasList = [];
          }
        }
      });
      saveList = [];
      if (isInit) { // 是第一次出现 将其添加到画布中
        addImg(canvasBox, currentImg.value.imgUrl);
      } else { // 之前有记录 加载之前的记录
        deserializationCanvas(canvasList.slice(-1)[0]);
      }
    }

    // 删除一张图片
    function deleteImg(img, index) {
      imgList.splice(index, 1);
      if (selectedImgIndex === index) {
        clearCanvas(canvasBox);
        currentImg = ref(null);
      }
    }

    function fileSelect() {
      if (fileElem) { fileElem.click(); }
    }

    function widthChange(value) {
      widthChanged = true;
      canvasBox.freeDrawingBrush.width = penWidth.value;
    }

    function mouseOut() {
      showWidthPicker.value = false;
      if (operationMode !== 'freeDraw' && widthChanged) {
        ElMessage.success('重新选择模式生效！');
        widthChanged = false;
      }
    }

    function colorChange(value) {
      canvasBox.freeDrawingBrush.color = penColor.value;
      if (operationMode !== 'freeDraw') {
        ElMessage.success('重新选择模式生效！');
      }
    }

    onMounted(() => {
      colorPickerEl = document.getElementById('colorPicker');
      fileElem = document.getElementById('fileElem');
      initCanvas();
      serializationCanvas();
      canvasAddEvent();
      operationMode = 'freeDraw';
      canvasBox.isDrawingMode = true;
    });

    return {
      operationMode,
      imgList,
      currentImg,
      canvasBox,
      pointCol,
      drawList,
      operationList,
      selectChange,
      selectImg,
      initCanvas,
      addImg,
      clearCanvas,
      deleteImg,
      operation,
      canvasAddEvent,
      penColor,
      colorPickerEl,
      showWidthPicker,
      penWidth,
      selectStrokeWidth,
      selectColor,
      fileSelect,
      serializationCanvas,
      OIMode,
      SFMode,
      widthChange,
      colorChange,
      mouseOut,
    };
  },
});
</script>

<style lang='less' scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  .el-container{
    width: 1200px;
    margin: auto;
    .el-aside{
      border: solid 1px #DCDFE6;
      border-radius: 10px;
      text-align: center;
      .imgList{
        width: 200px;
        list-style: none;
        margin: 30px 0 0 0;
        padding: 0;
        .imgItem{
          box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
          width: 180px;
          margin-bottom: 10px;
          margin: auto;
          img{
            width: 180px;
            height: auto;
          }
          .desc{
            text-align: left;
            margin: 0 5px;
            .bottom{
              display: flex;
              justify-content: space-between;
              height: 40px;
              line-height: 40px;
            }
          }
        }
      }
    }
    .el-main{
      background-color: grey;
      padding: 10px;
    }
     .control {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .ctlItem{
        position: relative;
        .hiddenCtl{
          position: absolute;
          top: -50px;
          left: -60px;
        }
        #colorPicker{
          top: -20px;
        }
      }
      .modeGroup{
        width: 80px;
        // height: 90%;
        .radioGroup{
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          align-items: center;
          .el-radio{
            margin: 5px 0;
          }
        }
      }
    }
  }
}
</style>
