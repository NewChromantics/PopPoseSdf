import GlContext_t from './TinyWebgl.js'
import FragSource from './PoseShader.js'
//	remove these big dependencies!
import Camera_t from './PopEngine/Camera.js'
import {Lerp,Add3,MatrixInverse4x4} from './PopEngine/Math.js'

import Game_t from './PoseGame.js'
import {CreatePromise,Yield} from './TinyWebgl.js'
import Pop from './PopEngine/PopEngine.js'
import {CreateCubeGeometry} from './PopEngine/CommonGeometry.js'
import {NormalToRainbow} from './PopEngine/Colour.js'


const VertSource = `
precision highp float;
attribute vec3 LocalPosition;
uniform mat4 WorldToCameraTransform;
uniform mat4 CameraProjectionTransform;
uniform vec3 WorldMin;
uniform vec3 WorldMax;
varying vec3 WorldPosition;	//	output
varying vec4 OutputProjectionPosition;
void main()
{
	//	expecting cube 0..1
	vec3 LocalPos01 = LocalPosition;
	vec4 WorldPos;
	WorldPos.xyz = mix( WorldMin, WorldMax, LocalPos01 );
	WorldPos.w = 1.0;
	vec4 CameraPos = WorldToCameraTransform * WorldPos;	//	world to camera space
	vec4 ProjectionPos = CameraProjectionTransform * CameraPos;
	gl_Position = ProjectionPos;
	
	WorldPosition = WorldPos.xyz;
	OutputProjectionPosition = gl_Position;
}
`;


const Camera = new Camera_t();
Camera.Position = [ 0.5,1.00,3.00001 ];
Camera.LookAt = [ 0,0,0 ];
Camera.FovVertical = 70;

let LastRenderTargetRect = [0,0,1,1];
let LastScreenRect = null;
		
function GetCameraUniforms(Uniforms,ScreenRect)
{
	LastScreenRect = ScreenRect;
	LastRenderTargetRect = [0,0,1,ScreenRect[3]/ScreenRect[2]];
	Uniforms.WorldToCameraTransform = Camera.GetWorldToCameraMatrix();
	Uniforms.CameraProjectionTransform = Camera.GetProjectionMatrix( LastRenderTargetRect );

	Uniforms.CameraToWorldTransform = MatrixInverse4x4( Uniforms.WorldToCameraTransform );
	Uniforms.RenderTargetRect = LastRenderTargetRect;
}


const InputState = {};
class InputValue_t
{
	constructor(uv,px,Force=1)
	{
		this.uv = uv;
		this.px = px;
		this.Force = Force;
	}
}
InputState.MouseButtonsDown = {};	//	key=button value=InputValue_t


function Range(Min,Max,Value)
{
	return (Value-Min) / (Max-Min);
}

function GetMouseValue(x,y,Button)
{	
	const Rect = {};
	//	gr: screen rect is window space
	//		xy is renderview space, so ignore x/y
	Rect.left = 0
	Rect.right = Rect.left + LastScreenRect[2];
	Rect.top = 0;
	Rect.bottom = Rect.top + LastScreenRect[3];
	const ClientX = x;
	const ClientY = y;
	const u = Range( Rect.left, Rect.right, ClientX ); 
	const v = Range( Rect.top, Rect.bottom, ClientY ); 
	
	let Input = new InputValue_t();
	Input.uv = [u,v]; 
	Input.px = [ClientX,ClientY]; 
	return Input;
}


//	return true to notify we used the input and don't pass onto game
function HandleMouse(Button,InputValue,FirstDown)
{
	if ( Button == 'Right' )
	{
		//	should just get px from event!	
		const [x,y] = InputValue.px;
		Camera.OnCameraOrbit( x, y, 0, FirstDown );
		return true;
	}
	
	if ( Button == GetWheelButton() )
	{
		Camera.OnCameraZoom( -InputValue.Force );
		return true;
	}

	return false;
}

function HtmlMouseToButton(Button)
{
	return ['Left','Middle','Right','Back','Forward'][Button];
}
function GetHoverButton()
{
	return 'Hover';
}
function GetWheelButton()
{
	return 'Wheel';
}

function OnMouseMove(x,y,Button)
{
	let Value = GetMouseValue(x,y,Button);
	if ( Button === null )
		Button = GetHoverButton();
	
	if ( HandleMouse( Button, Value, false ) )
		return;
		
	InputState.MouseButtonsDown[Button] = Value;
	/*
	//	update all buttons
	const Buttons = Event.buttons || 0;	//	undefined if touches
	const ButtonMasks = [ 1<<0, 1<<2, 1<<1 ];	//	move button bits do NOT match mouse events
	const ButtonsDown = ButtonMasks.map( (Bit,Button) => (Buttons&Bit)?HtmlMouseToButton(Button):null ).filter( b => b!==null );
	
	if ( !ButtonsDown.length )
		ButtonsDown.push(GetHoverButton()); 
	
	function OnMouseButton(Button)
	{
		if ( HandleMouse( Button, Value, false ) )
			return;
		InputState.MouseButtonsDown[Button] = Value;
	}
	ButtonsDown.forEach(OnMouseButton);
	*/
	
}

function OnMouseDown(x,y,Button)
{
	delete InputState.MouseButtonsDown[GetHoverButton()];

	let Value = GetMouseValue(x,y,Button);
	if ( HandleMouse( Button, Value, true ) )
		return;

	InputState.MouseButtonsDown[Button] = Value;
}

function OnMouseUp(x,y,Button)
{
	let Value = GetMouseValue(x,y,Button);
	delete InputState.MouseButtonsDown[Button];
}

function OnMouseScroll(x,y,Button,WheelDelta)
{
	//	gr should update mouse here?
	Button = GetWheelButton();
	let Value = GetMouseValue(x,y,Button);
	//console.log(`MouseWheel ${uv}`);
	
	Value.Force = WheelDelta[1];

	//const Button = GetWheelButton();

	if ( HandleMouse( Button, Value, true ) )
		return;
	
	//	need to either auto-remove this state once read, or maybe we need an event queue (probably that)
	InputState.MouseButtonsDown[Button] = Value;
}



function BindEvents(RenderView)
{
	RenderView.OnMouseDown = OnMouseDown;
	RenderView.OnMouseMove = OnMouseMove;
	RenderView.OnMouseUp = OnMouseUp;
	RenderView.OnMouseScroll = OnMouseScroll;
}

function GetInputRays()
{
	//	turn 2d inputs into 3d rays 
	//	in future, 3d input can be really small rays at the tips of fingers etc
	let State3 = {};
	
	for ( let Button of Object.keys(InputState.MouseButtonsDown) )
	{
		const uv = InputState.MouseButtonsDown[Button].uv;
		const Ray = GetRayFromCameraUv(uv);
		State3[Button] = Ray;
	}
	
	return State3;
}


function GetRayFromCameraUv(uv)
{
	const WorldRay = Camera.GetScreenRay(...uv,LastRenderTargetRect);
	return WorldRay;
}


export class SceneManager_t
{
	constructor()
	{
	}
	
	GetBoundingBox()
	{
		let Size = 100;
		const Box = {};
		Box.Min = [-Size,-Size,-Size];
		Box.Max = [Size,Size,Size];
		return Box;
	}
	
	GetObjectUniforms()
	{
		return {};
	}
}

async function RenderLoop(Canvas,GetGame)
{
	let Window;
	//let Window = new Pop.Gui.Window();
	let RenderView = new Pop.Gui.RenderView(Window,Canvas);
	let Context = new Pop.Sokol.Context(RenderView);

	BindEvents(RenderView);

	const SceneShader = await Context.CreateShader( VertSource, FragSource );
	const CubeGeo = CreateCubeGeometry();
	const SceneCube = await Context.CreateGeometry( CubeGeo );
	
	const Scene = new SceneManager_t();
	
	async function RenderScene(Game)
	{
		if ( !SceneShader )
			return;
		const Uniforms = {};
		GetCameraUniforms(Uniforms,Context.GetScreenRect());
		
		if ( Game )
			Object.assign(Uniforms,Game.GetUniforms());

		//	bounding box
		const SceneBounds = Scene.GetBoundingBox();
		Uniforms.WorldMin = SceneBounds.Min;
		Uniforms.WorldMax = SceneBounds.Max;
		//Object.assign( Uniforms, Scene.GetObjectUniforms() );
		//Context.Draw(SceneCube,SceneShader,Uniforms);
		return ['Draw',SceneCube,SceneShader,Uniforms];
	}
	
	
	while(true)
	{
		let Game = GetGame();
		let Time = 0;
		
		const TimeDelta = 1/60;
		
		if ( Game )
		{
			Game.Iteration(TimeDelta,GetInputRays());
		}

		//	render
		Time = Time/100 % 1;
		const ClearColour = NormalToRainbow(Time);
		const ClearCmd = ['SetRenderTarget',null,ClearColour];
		
		const SceneCmd = await RenderScene(Game);
	
		const RenderCommands = [ClearCmd,SceneCmd].filter( c => c!=null );
		await Context.Render(RenderCommands);
	}
}


async function AppLoop(Canvas)
{
	let Game;
	function GetGame()
	{
		return Game;
	}
	const RenderThread = RenderLoop(Canvas,GetGame);

	while ( true )
	{
		Game = new Game_t();
		const Result = await Game.GameLoop();
		window.alert(Result);
		Yield(3000);
		Game = null;
	}
}


export default AppLoop;

