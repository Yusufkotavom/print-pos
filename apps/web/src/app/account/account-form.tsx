"use client";

import { useState } from "react";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

export function AccountForm({ user }: { user: { id: string; name: string; email: string } }) {
	const [name, setName] = useState(user.name);
	const [isUpdating, setIsUpdating] = useState(false);

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);

	const updateProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsUpdating(true);
		try {
			const res = await authClient.updateUser({
				name,
			});
			if (res.error) {
				toast.error(res.error.message || "Failed to update profile");
			} else {
				toast.success("Profile updated successfully");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setIsUpdating(false);
		}
	};

	const changePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsPasswordUpdating(true);
		try {
			const res = await authClient.changePassword({
				newPassword,
				currentPassword,
				revokeOtherSessions: true,
			});
			if (res.error) {
				toast.error(res.error.message || "Failed to change password");
			} else {
				toast.success("Password changed successfully");
				setCurrentPassword("");
				setNewPassword("");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setIsPasswordUpdating(false);
		}
	};

	return (
		<div className="grid gap-6">
			<Card>
				<form onSubmit={updateProfile}>
					<CardHeader>
						<CardTitle>Profile Details</CardTitle>
						<CardDescription>Update your personal information.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="email">Email (Cannot be changed)</Label>
							<Input id="email" type="email" value={user.email} disabled />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="name">Full Name</Label>
							<Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
						</div>
					</CardContent>
					<CardFooter>
						<Button disabled={isUpdating}>
							{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Changes
						</Button>
					</CardFooter>
				</form>
			</Card>

			<Card>
				<form onSubmit={changePassword}>
					<CardHeader>
						<CardTitle>Security</CardTitle>
						<CardDescription>Update your password to keep your account secure.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="currentPassword">Current Password</Label>
							<Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="newPassword">New Password</Label>
							<Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
						</div>
					</CardContent>
					<CardFooter>
						<Button disabled={isPasswordUpdating || !currentPassword || !newPassword}>
							{isPasswordUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Change Password
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
