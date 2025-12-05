import axios, { AxiosError } from "axios";
import { getStagingDatabase } from "./stagingDatabase";
import type { ConflictData } from "../components/ConflictsList";
import LZString from "lz-string";

// TODO: rapihkan function-function di file ini

interface User {
  username: string;
  type: "kesiswaan" | "sekretaris" | "wali_kelas";
  kelas?: number;
}

export function getApiBaseUrl() {
  let baseUrl = sessionStorage.getItem("DJANGO_API_BASE_URL");

  if (baseUrl === "{{ BASE_API_URL }}" || !baseUrl) {
    baseUrl = import.meta.env.VITE_DJANGO_BASE_API_URL as string;
  }

  return baseUrl;
}

export async function getVersion(): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const response = await axios.get(baseUrl + "/version");
  return response.data;
}

export async function ping(): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const response = await axios.get(baseUrl + "/ping");
  return response.data;
}

export async function getMe(token: string): Promise<User> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.get(baseUrl + "/me", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return response.data.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function getSiswas(token: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.get(baseUrl + "/siswas", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return response.data.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function login(
  username: string,
  password: string
): Promise<{ token: string; username: string; type: string }> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.post(baseUrl + "/login", {
      username,
      password,
    });
    return {
      token: response.data.data.token,
      username: response.data.data.username,
      type: response.data.data.type,
    };
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function refreshDatabase(token: string): Promise<string> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.get(baseUrl + "/data", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return response.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function uploadDatabase(
  token: string
): Promise<{ conflicts: ConflictData[] }> {
  const baseUrl = getApiBaseUrl();
  const payload = getStagingDatabase();
  const data = LZString.compressToBase64(JSON.stringify(payload));

  try {
    const response = await axios.post(
      baseUrl + "/compressed-upload",
      { data },
      {
        headers: {
          Authorization: "Bearer " + token,
        },
      }
    );
    return response.data.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function changePassword(
  token: string,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.post(
      baseUrl + "/change-password",
      {
        old_password: oldPassword,
        new_password: newPassword,
      },
      {
        headers: {
          Authorization: "Bearer " + token,
        },
      }
    );
    return response.data.data.success;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function getRekap(
  token: string,
  bulan: number,
  tahun: number,
  kelas: number
): Promise<string> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.get(
      baseUrl + `/get-rekap?bulan=${bulan}&tahun=${tahun}&kelas=${kelas}`,
      {
        headers: {
          Authorization: "Bearer " + token,
        },
      }
    );
    return response.data.data.file_id;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function getBulan(token: string): Promise<
  {
    bulan: string;
    bulan_humanize: string;
  }[]
> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.get(baseUrl + "/bulan", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return response.data.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function getAbsensi(
  token: string,
  date: string,
  kelasId: number
): Promise<
  Record<number, "hadir" | "sakit" | "izin" | "alfa" | "bolos" | null>
> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.get(baseUrl + "/absensi", {
      params: {
        date,
        kelas_id: kelasId,
      },
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return response.data.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}

export async function getAbsensiesProgress(
  token: string,
  dates: string[],
  kelasId: number
): Promise<
  Record<string, { total_tidak_masuk: number; is_complete: boolean }>
> {
  const baseUrl = getApiBaseUrl();
  try {
    const response = await axios.get(baseUrl + "/absensi/progress", {
      params: {
        dates: dates.join(","),
        kelas_id: kelasId,
      },
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return response.data.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (
        (e.response?.status ?? 0) >= 500 &&
        (e.response?.status ?? 0) <= 510
      ) {
        throw new Error("Server sedang offline");
      } else if (!e.response?.data.detail) {
        throw new Error("Tidak ada internet");
      } else {
        throw new Error(e.response?.data.detail);
      }
    }
    throw new Error();
  }
}
