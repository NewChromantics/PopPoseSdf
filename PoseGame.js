import {DegToRad,Add3,Multiply3,Length3,GetRayRayIntersection3,Clamp01} from './PopEngine/Math.js'
import {CreatePromise,Yield} from './TinyWebgl.js'
import PromiseQueue from './PopEngine/PromiseQueue.js'

class Track_t
{
	constructor()
	{
		this.Points = [
		[0,0],
		[4,0],
		[4,2],
		[3,4],
		[-2,4],
		];
	}
}


const Colours = [
[182, 224, 43],
[237,103,62]
];

const TurnAnglesPerMetre = 150;
const MaxWheelAngle = 45;
const FrictionPerSec = 1.0;
const AccellForce = 0.3;	//	need to turn this into a throttle

class Car_t
{
	constructor(CarIndex)
	{
		this.Colour = Colours[CarIndex%Colours.length].map(f=>f/255);
		this.Position = [0,0,0];
		
		this.BodyAngleDegrees = 0;
		this.WheelAngleDegrees = 0;
		this.Position[0] += CarIndex * 0.5;
		this.Velocity = [0,0,0];
	}
	
	get BodyAngleRadians()
	{
		return DegToRad(this.BodyAngleDegrees);
	}
	get WheelAngleRadians()
	{
		return DegToRad(this.WheelAngleDegrees);
	}
	
	get SpeedNormal()
	{
		let MaxSpeed = 0.1;
		let Speed = Length3(this.Velocity);
		return Speed/MaxSpeed;
	}
	
	Iteration(TimeDelta,InputTurn,InputPower=0)
	{
		
	}
}

export default class Game_t
{
	constructor()
	{
		this.MouseUv = [0.5,0.5];
		this.MouseButtonsDown = {};	//	key=button value=uv
		this.WorldLightPosition = [1.9,1.4,1.8];
		
		this.Event_Finished = CreatePromise();
		
		this.Track = new Track_t();
		this.Cars = [];
		for ( let i=0;	i<33;	i++ )
			this.Cars.push( new Car_t(i) );
			
		this.NewPoseQueue = new PromiseQueue('Poses');
	}
	
	async GameLoop()
	{
		this.Pose = new window.Pose({locateFile: (file) => {
			return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
		}});
		
		this.Pose.setOptions({
			modelComplexity: 1,
			smoothLandmarks: true,
			enableSegmentation: true,
			smoothSegmentation: true,
			minDetectionConfidence: 0.5,
			minTrackingConfidence: 0.5
		});
		this.Pose.onResults( Results => this.NewPoseQueue.Push(Results) );
		
		const videoElement = document.getElementsByClassName('input_video')[0];

		const OnCameraFrame = async ()=>
		{
			await this.Pose.send({image: videoElement});
		};
		const CameraOptions = 
		{
			onFrame: OnCameraFrame,
			width:1280,
			height:720
		};		
		this.Camera = new window.Camera(videoElement,CameraOptions);
		this.Camera.start();

		while ( this.Pose )
		{
			const Pose = await this.NewPoseQueue.WaitForNext();
			this.UpdatePose(Pose.poseLandmarks);
		}

		await this.Event_Finished;
		return `Game over`;
	}
	
	UpdatePose(Joints)
	{
		Joints = Joints || [];
		
		function ConvertXyz(Position)
		{
			if ( Position.visibility < 0.6 )
				return null;
			let Scale = 4;
			return [Position.x*Scale,Position.z*Scale,Position.y*Scale];
		}
		Joints = Joints.map( ConvertXyz ).filter( p => p!=null );
		
		//this.Track.Points = Joints;
		
		
		for ( let i=0;	i<Joints.length;	i++ )
		{
			const Car = this.Cars[i];
			if ( !Car )
				continue;
			const xyz = Joints[i];
			Car.Position = xyz;
		}
		//console.log(Pose);
	}
	
	Iteration(TimeDelta,InputRays)
	{
		
	}
	
	GetUniforms()
	{
		const Uniforms = Object.assign({},this);
		Uniforms.CarPositions = this.Cars.map( c => c.Position ).flat();
		Uniforms.CarColours = this.Cars.map( c => c.Colour ).flat();
		Uniforms.CarAngles = this.Cars.map( c => 0 );
		
		Uniforms.TrackPoints = this.Track.Points.flat();
		
		return Uniforms;
	}
}
