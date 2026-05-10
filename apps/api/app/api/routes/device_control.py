from fastapi import APIRouter, Depends, HTTPException, status

from app.clients.lovense_bridge_client import LovenseBridgeError
from app.dependencies import get_device_control_service
from app.schemas.device_control import (
    DeviceCommandResult,
    DeviceConnectRequest,
    DeviceControlFeatureStatus,
    DeviceControlRequest,
    DeviceDisconnectRequest,
    DevicePlayPatternRequest,
    DeviceSavePatternRequest,
    DeviceStopRequest,
)
from app.services.device_control_service import (
    DeviceControlDisabledError,
    DeviceControlService,
    DeviceControlValidationError,
)

router = APIRouter(prefix="/device-control", tags=["device-control"])


@router.get("/health", response_model=DeviceControlFeatureStatus)
async def device_control_health(
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceControlFeatureStatus:
    return await service.get_health()


@router.post("/scan", response_model=DeviceCommandResult)
async def scan_devices(
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.scan())


@router.get("/toys", response_model=DeviceCommandResult)
async def list_toys(
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.list_toys())


@router.post("/connect", response_model=DeviceCommandResult)
async def connect_device(
    payload: DeviceConnectRequest,
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.connect(device_id=payload.device_id))


@router.post("/disconnect", response_model=DeviceCommandResult)
async def disconnect_device(
    payload: DeviceDisconnectRequest,
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.disconnect(device_id=payload.device_id))


@router.post("/control", response_model=DeviceCommandResult)
async def control_device(
    payload: DeviceControlRequest,
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(
        service.control(
            device_id=payload.device_id,
            action=payload.action,
            intensity=payload.intensity,
            duration_seconds=payload.duration_seconds,
            motor=payload.motor,
            loop_on_seconds=payload.loop_on_seconds,
            loop_off_seconds=payload.loop_off_seconds,
        )
    )


@router.post("/stop", response_model=DeviceCommandResult)
async def stop_device(
    payload: DeviceStopRequest,
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.stop(device_id=payload.device_id))


@router.get("/patterns", response_model=DeviceCommandResult)
async def list_patterns(
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.list_patterns())


@router.post("/patterns", response_model=DeviceCommandResult)
async def save_pattern(
    payload: DeviceSavePatternRequest,
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.save_pattern(payload))


@router.delete("/patterns/{name}", response_model=DeviceCommandResult)
async def delete_pattern(
    name: str,
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.delete_pattern(name))


@router.post("/patterns/play", response_model=DeviceCommandResult)
async def play_pattern(
    payload: DevicePlayPatternRequest,
    service: DeviceControlService = Depends(get_device_control_service),
) -> DeviceCommandResult:
    return await _execute(service.play_pattern(payload))


async def _execute(coro):
    try:
        return await coro
    except DeviceControlDisabledError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except DeviceControlValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except LovenseBridgeError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
